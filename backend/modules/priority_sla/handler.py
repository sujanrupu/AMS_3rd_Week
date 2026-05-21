# modules/priority_sla/handler.py
# ─────────────────────────────────────────────────────────────────────────────
# Priority SLA Handler
# Orchestrates: KB search → agent revalidation → priority/SLA assignment
# ─────────────────────────────────────────────────────────────────────────────

from services.embedding_service import get_embedding
from repositories.ticket_repository import supabase as ticket_db

from repositories.priority_sla_repository import (
    search_impact_kb,
    search_urgency_kb,
    update_ticket_priority_sla,
)

from modules.priority_sla.agent import (
    run_impact_agent,
    run_urgency_agent,
    build_impact_kb_context,
    build_urgency_kb_context,
)

from modules.priority_sla.service import (
    get_priority,
    get_sla,
    requires_human_review,
    compute_confidence_score,
    get_confidence_label,
    pick_revalidated_value,
    VALID_IMPACTS,
    VALID_URGENCIES,
)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN HANDLER — plugs into orchestrator state machine
# ─────────────────────────────────────────────────────────────────────────────

async def handle_priority_sla_flow(state: dict) -> dict:
    """
    Receives orchestrator state, returns updated state with priority + SLA.

    Reads from state:
        data          → original TicketRequest
        id            → issue_key created by duplicate detection step
        summary
        is_duplicate  → skip priority assignment for duplicates

    Writes to state:
        revalidated_impact, revalidated_urgency
        impact_confidence, urgency_confidence
        priority, sla
        requires_human_review
        priority_sla_rationale  (dict with impact/urgency rationale strings)
    """


    data       = state.get("data") or {}
    issue_key  = state.get("id")
    summary    = state.get("summary", "")

    description    = _get(data, "description", "")
    app_name       = _get(data, "app_name", "")
    component_name = _get(data, "component_name", "")
    user_impact    = _get(data, "impact", "")
    user_urgency   = _get(data, "urgency", "")

    # ── validate user-supplied values ────────────────────────────────────────
    if user_impact not in VALID_IMPACTS:
        print(f"[PrioritySLA] ⚠️  Invalid impact '{user_impact}', defaulting to Moderate")
        user_impact = "Moderate"

    if user_urgency not in VALID_URGENCIES:
        print(f"[PrioritySLA] ⚠️  Invalid urgency '{user_urgency}', defaulting to Medium")
        user_urgency = "Medium"

    # ── embed the query text (summary + description) ─────────────────────────
    query_text = f"{summary}\n{description}".strip()
    embedding  = await get_embedding(query_text)

    if embedding:
        embedding = [float(x) for x in embedding]

    # ── step 1: vector search against both KBs ────────────────────────────────
    impact_matches  = []
    urgency_matches = []

    if embedding:
        impact_matches = await search_impact_kb(
            query_embedding  = embedding,
            top_k            = 5,
            min_similarity   = 0.35,
            app_filter       = app_name or None,
            component_filter = component_name or None,
        )
        urgency_matches = await search_urgency_kb(
            query_embedding  = embedding,
            top_k            = 5,
            min_similarity   = 0.35,
            app_filter       = app_name or None,
            component_filter = component_name or None,
        )

    # ── step 2: build KB context strings for agents ──────────────────────────
    impact_kb_ctx  = build_impact_kb_context(impact_matches)
    urgency_kb_ctx = build_urgency_kb_context(urgency_matches)

    # ── step 3: run LLM agents ───────────────────────────────────────────────
    impact_result  = await run_impact_agent(
        summary     = summary,
        description = description,
        user_impact = user_impact,
        kb_context  = impact_kb_ctx,
    )

    urgency_result = await run_urgency_agent(
        summary      = summary,
        description  = description,
        user_urgency = user_urgency,
        kb_context   = urgency_kb_ctx,
    )

    # ── step 4: confidence scoring (KB similarity-based) ─────────────────────
    # Primary confidence comes from KB similarity; agent confidence is a signal.
    # We blend them: KB gives the base, agent refines.
    kb_impact_confidence  = compute_confidence_score(impact_matches)
    kb_urgency_confidence = compute_confidence_score(urgency_matches)

    # If KB returned no matches, fall back entirely to agent confidence.
    final_impact_confidence  = kb_impact_confidence  if impact_matches  else impact_result["confidence"]
    final_urgency_confidence = kb_urgency_confidence if urgency_matches else urgency_result["confidence"]

    # ── step 5: pick final revalidated values ────────────────────────────────
    # The KB-voted value vs agent-voted value: prefer agent when KB has no hits,
    # prefer KB-majority when we have high-confidence matches.
    revalidated_impact, impact_changed = pick_revalidated_value(
        kb_matches       = impact_matches,
        user_value       = user_impact,
        field            = "revalidated_impact",
        confidence_score = final_impact_confidence,
    )

    revalidated_urgency, urgency_changed = pick_revalidated_value(
        kb_matches       = urgency_matches,
        user_value       = user_urgency,
        field            = "revalidated_urgency",
        confidence_score = final_urgency_confidence,
    )

    # If KB had low confidence but agent is confident, use agent's value
    if not impact_matches or final_impact_confidence < 50:
        revalidated_impact  = impact_result["revalidated_impact"]
        impact_changed      = revalidated_impact != user_impact

    if not urgency_matches or final_urgency_confidence < 50:
        revalidated_urgency = urgency_result["revalidated_urgency"]
        urgency_changed     = revalidated_urgency != user_urgency

    # ── step 6: priority matrix lookup ───────────────────────────────────────
    priority = get_priority(revalidated_impact, revalidated_urgency)

    if not priority:
        print(f"[PrioritySLA] ⚠️  Could not resolve priority for "
              f"impact={revalidated_impact}, urgency={revalidated_urgency}. Defaulting to P3.")
        priority = "P3"

    # ── step 7: SLA rules ────────────────────────────────────────────────────
    sla            = get_sla(priority)
    needs_hitl     = requires_human_review(priority)

    # ── step 8: persist to DB ────────────────────────────────────────────────
    if issue_key:
        await update_ticket_priority_sla(
            issue_key            = issue_key,
            revalidated_impact   = revalidated_impact,
            revalidated_urgency  = revalidated_urgency,
            priority             = priority,
            sla_response_time    = sla.get("response_time", ""),
            sla_resolution_time  = sla.get("resolution_time", ""),
            impact_confidence    = final_impact_confidence,
            urgency_confidence   = final_urgency_confidence,
        )

    print(
        f"[PrioritySLA] ✅ {issue_key} | "
        f"Impact: {user_impact}→{revalidated_impact} (conf={final_impact_confidence}) | "
        f"Urgency: {user_urgency}→{revalidated_urgency} (conf={final_urgency_confidence}) | "
        f"Priority: {priority} | HITL: {needs_hitl}"
    )

    # ── return enriched state ────────────────────────────────────────────────
    return {
        **state,

        # revalidated values
        "revalidated_impact":   revalidated_impact,
        "revalidated_urgency":  revalidated_urgency,
        "impact_changed":       impact_changed,
        "urgency_changed":      urgency_changed,

        # confidence
        "impact_confidence":        final_impact_confidence,
        "urgency_confidence":       final_urgency_confidence,
        "impact_confidence_label":  get_confidence_label(final_impact_confidence),
        "urgency_confidence_label": get_confidence_label(final_urgency_confidence),

        # priority + SLA
        "priority":              priority,
        "sla_response_time":     sla.get("response_time", ""),
        "sla_resolution_time":   sla.get("resolution_time", ""),
        "sla_description":       sla.get("description", ""),
        "requires_human_review": needs_hitl,

        # rationale (for HITL popup / frontend display)
        "priority_sla_rationale": {
            "impact":  impact_result.get("rationale", ""),
            "urgency": urgency_result.get("rationale", ""),
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — safe attribute/dict access
# ─────────────────────────────────────────────────────────────────────────────

def _get(obj, key: str, default=""):
    if hasattr(obj, key):
        return getattr(obj, key) or default
    if isinstance(obj, dict):
        return obj.get(key) or default
    return default
