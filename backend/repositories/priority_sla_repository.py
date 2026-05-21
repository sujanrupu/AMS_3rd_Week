# repositories/priority_sla_repository.py
# ─────────────────────────────────────────────────────────────────────────────
# Data access layer for the Priority SLA module.
# Wraps the two KB tables and the ticket update.
# ─────────────────────────────────────────────────────────────────────────────

from supabase import create_client
from core.config import Config
from datetime import datetime, timezone

supabase = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)


# ─────────────────────────────────────────────────────────────────────────────
# VECTOR SEARCH — IMPACT KB
# Calls the search_impact_kb RPC defined in priority_sla_kb.sql
# ─────────────────────────────────────────────────────────────────────────────

async def search_impact_kb(
    query_embedding: list,
    top_k: int = 5,
    min_similarity: float = 0.35,
    app_filter: str | None = None,
    component_filter: str | None = None,
) -> list:
    """
    Vector similarity search against impact_assessment_kb.
    Returns list of row dicts (with a 'similarity' float field added).
    """
    try:
        if not query_embedding:
            return []

        params = {
            "query_embedding": [float(x) for x in query_embedding],
            "top_k":           top_k,
            "min_similarity":  min_similarity,
            "app_filter":      app_filter,
            "component_filter": component_filter,
        }

        res = supabase.rpc("search_impact_kb", params).execute()
        return res.data or []

    except Exception as e:
        print(f"❌ search_impact_kb error: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# VECTOR SEARCH — URGENCY KB
# ─────────────────────────────────────────────────────────────────────────────

async def search_urgency_kb(
    query_embedding: list,
    top_k: int = 5,
    min_similarity: float = 0.35,
    app_filter: str | None = None,
    component_filter: str | None = None,
) -> list:
    """
    Vector similarity search against urgency_assessment_kb.
    Returns list of row dicts (with a 'similarity' float field added).
    """
    try:
        if not query_embedding:
            return []

        params = {
            "query_embedding": [float(x) for x in query_embedding],
            "top_k":           top_k,
            "min_similarity":  min_similarity,
            "app_filter":      app_filter,
            "component_filter": component_filter,
        }

        res = supabase.rpc("search_urgency_kb", params).execute()
        return res.data or []

    except Exception as e:
        print(f"❌ search_urgency_kb error: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE TICKET — write priority + SLA columns back to the tickets table
# (these columns are added by priority_sla_kb.sql section 3)
# ─────────────────────────────────────────────────────────────────────────────

async def update_ticket_priority_sla(
    issue_key: str,
    revalidated_impact: str,
    revalidated_urgency: str,
    priority: str,
    sla_response_time: str,
    sla_resolution_time: str,
    impact_confidence: int,
    urgency_confidence: int,
) -> bool:
    """
    Persists priority + SLA fields onto the existing ticket row.
    Returns True on success.
    """
    try:
        payload = {
            "revalidated_impact":   revalidated_impact,
            "revalidated_urgency":  revalidated_urgency,
            "priority":             priority,
            "sla_response_time":    sla_response_time,
            "sla_resolution_time":  sla_resolution_time,
            "impact_confidence":    impact_confidence,
            "urgency_confidence":   urgency_confidence,
            "priority_assigned_at": datetime.now(timezone.utc).isoformat(),
        }

        res = (
            supabase
            .table("tickets")
            .update(payload)
            .eq("issue_key", issue_key)
            .execute()
        )

        return bool(res.data)

    except Exception as e:
        print(f"❌ update_ticket_priority_sla error: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# INSERT KB ENTRY — add a confirmed ticket to the impact KB
# (called by kb_seeder or after human review confirms the classification)
# ─────────────────────────────────────────────────────────────────────────────

async def insert_impact_kb_entry(data: dict) -> dict | None:
    """
    data must contain: app, component, summary, description,
                       revalidated_impact, embedding (list[float])
    Optional: affected_users, business_area
    """
    try:
        if data.get("embedding"):
            data["embedding"] = [float(x) for x in data["embedding"]]

        res = supabase.table("impact_assessment_kb").insert(data).execute()
        return res.data[0] if res.data else None

    except Exception as e:
        print(f"❌ insert_impact_kb_entry error: {e}")
        return None


async def insert_urgency_kb_entry(data: dict) -> dict | None:
    """
    data must contain: app, component, summary, description,
                       revalidated_urgency, embedding (list[float])
    Optional: time_sensitivity, workaround
    """
    try:
        if data.get("embedding"):
            data["embedding"] = [float(x) for x in data["embedding"]]

        res = supabase.table("urgency_assessment_kb").insert(data).execute()
        return res.data[0] if res.data else None

    except Exception as e:
        print(f"❌ insert_urgency_kb_entry error: {e}")
        return None
