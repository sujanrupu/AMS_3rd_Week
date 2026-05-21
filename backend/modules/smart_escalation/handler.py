from datetime import datetime, timezone

from services.embedding_service import get_embedding
from repositories.escalation_repository import (
    search_escalation_kb,
    get_feedback_counts,
)
from repositories.ticket_repository import update_ticket_escalation_v2
from .agent import run_escalation_agent
from .service import (
    get_confidence_label,
    get_escalation_action,
    apply_learning_boost,
    build_learned_signal_text,
)

KB_SIMILARITY_THRESHOLD = 0.45


async def handle_smart_escalation(state: dict) -> dict:

    issue_key   = state.get("id") or state.get("issue_key")
    summary     = state.get("summary", "")

    raw_data    = state.get("data")
    if hasattr(raw_data, "description"):
        description = raw_data.description or ""
    elif isinstance(raw_data, dict):
        description = raw_data.get("description", "")
    else:
        description = ""

    if not summary and not description:
        return {
            **state,
            "type":    "error",
            "message": "Escalation handler: ticket has no summary or description.",
        }

    # ── Step 1: Embed the incident ──
    incident_text = f"{summary} {description}".strip()
    embedding     = await get_embedding(incident_text)
    kb_matches    = []
    kb_context    = ""

    # ── Step 2: Search KB (the AI reads the "document") ──
    if embedding:
        embedding  = [float(x) for x in embedding]
        kb_matches = await search_escalation_kb(embedding, top_k=5, min_similarity=0.35)

        if kb_matches:
            kb_context = _build_kb_context(kb_matches)

    # ── Step 3: Get self-learning signals ──
    learned_signal   = ""
    confirmed_count  = 0
    corrected_count  = 0

    if kb_matches:
        top       = kb_matches[0]
        top_team  = top["recommended_team"]
        top_level = top["recommended_level"]

        counts = await get_feedback_counts(top_team, top_level)
        confirmed_count  = counts.get("confirmed", 0)
        corrected_count  = counts.get("corrected", 0)

        learned_signal = build_learned_signal_text(
            team            = top_team,
            level           = top_level,
            confirmed_count = confirmed_count,
            corrected_count = corrected_count,
        )

    # ── Step 4: LLM agent decision ──
    agent_result = await run_escalation_agent(
        summary        = summary,
        description    = description,
        kb_context     = kb_context,
        learned_signal = learned_signal,
    )

    raw_confidence = agent_result["confidence"]
    team           = agent_result["team"]
    level          = agent_result["level"]
    rationale      = agent_result["rationale"]

    # ── Step 5: Apply learning boost / penalty ──
    final_confidence = apply_learning_boost(
        raw_confidence      = raw_confidence,
        feedback_count      = confirmed_count,
        was_corrected_count = corrected_count,
    )

    confidence_label = get_confidence_label(final_confidence)
    action           = get_escalation_action(confidence_label)

    print(
        f"[EscalationHandler] {issue_key} → "
        f"team={team} | level={level} | "
        f"conf={raw_confidence}→{final_confidence} ({confidence_label}) | "
        f"action={action}"
    )

    now = datetime.now(timezone.utc).isoformat()

    # ── Step 6: Persist to tickets table ──
    if issue_key:
        await update_ticket_escalation_v2(
            issue_key      = issue_key,
            esc_team       = team,
            esc_level      = level,
            esc_confidence = confidence_label,
            esc_action     = action,
            esc_rationale  = rationale,
            escalated_at   = now,
        )

    return {
        **state,
        "type":               "escalation_complete",
        "issue_key":          issue_key,
        "esc_team":           team,
        "esc_level":          level,
        "esc_confidence":     confidence_label,
        "esc_confidence_raw": final_confidence,
        "esc_action":         action,
        "esc_rationale":      rationale,
        "escalated_at":       now,
    }


def _build_kb_context(matches: list) -> str:
    lines = []
    for i, match in enumerate(matches, start=1):
        sim_pct = round(match.get("similarity", 0) * 100, 1)
        lines.append(
            f"[KB Match {i}] "
            f"Category: {match['incident_category']} / {match.get('sub_category', '')} | "
            f"Similarity: {sim_pct}%\n"
            f"  Example: {match['example_description'][:200]}\n"
            f"  → Recommended: {match['recommended_team']} at {match['recommended_level']}\n"
            f"  → Rationale: {match['rationale']}"
        )
    return "\n\n".join(lines)