from datetime import datetime, timezone

from core.config import supabase


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────
# KNOWLEDGE BASE SEARCH
# ─────────────────────────────────────────────────────────────

async def search_escalation_kb(
    embedding: list,
    top_k: int = 5,
    min_similarity: float = 0.35,
) -> list:
    try:
        response = supabase.rpc(
            "search_escalation_kb",
            {
                "query_embedding": embedding,
                "top_k":           top_k,
                "min_similarity":  min_similarity,
            }
        ).execute()

        return response.data or []

    except Exception as e:
        print(f"[EscalationRepo] ❌ search_escalation_kb failed: {e}")
        return []


async def increment_kb_confirmed(kb_id: int) -> None:
    try:
        row = supabase.table("escalation_kb").select(
            "human_confirmed_count"
        ).eq("id", kb_id).single().execute().data

        if not row:
            return

        new_count = (row.get("human_confirmed_count") or 0) + 1

        supabase.table("escalation_kb").update({
            "human_confirmed_count": new_count,
            "last_human_action_at":  _now_iso(),
            "updated_at":            _now_iso(),
        }).eq("id", kb_id).execute()

        print(f"[EscalationRepo] ✅ KB row {kb_id} confirmed_count → {new_count}")

    except Exception as e:
        print(f"[EscalationRepo] ⚠️  increment_kb_confirmed failed: {e}")


async def increment_kb_corrected(kb_id: int) -> None:
    try:
        row = supabase.table("escalation_kb").select(
            "human_corrected_count"
        ).eq("id", kb_id).single().execute().data

        if not row:
            return

        new_count = (row.get("human_corrected_count") or 0) + 1

        supabase.table("escalation_kb").update({
            "human_corrected_count": new_count,
            "last_human_action_at":  _now_iso(),
            "updated_at":            _now_iso(),
        }).eq("id", kb_id).execute()

        print(f"[EscalationRepo] ✅ KB row {kb_id} corrected_count → {new_count}")

    except Exception as e:
        print(f"[EscalationRepo] ⚠️  increment_kb_corrected failed: {e}")


# ─────────────────────────────────────────────────────────────
# HUMAN FEEDBACK LOG
# ─────────────────────────────────────────────────────────────

async def log_escalation_feedback(
    ticket_key:     str,
    ai_team:        str | None,
    ai_level:       str | None,
    ai_confidence:  str | None,
    human_team:     str,
    human_level:    str,
    human_reason:   str,
    was_overridden: bool,
    review_type:    str,
) -> bool:
    try:
        supabase.table("escalation_feedback").insert({
            "ticket_key":    ticket_key,
            "ai_team":       ai_team,
            "ai_level":      ai_level,
            "ai_confidence": ai_confidence,
            "human_team":    human_team,
            "human_level":   human_level,
            "human_reason":  human_reason,
            "was_overridden": was_overridden,
            "review_type":   review_type,
        }).execute()

        print(
            f"[EscalationRepo] ✅ Feedback logged for {ticket_key} | "
            f"overridden={was_overridden}"
        )
        return True

    except Exception as e:
        print(f"[EscalationRepo] ❌ log_escalation_feedback failed: {e}")
        return False


async def get_feedback_counts(team: str, level: str) -> dict:
    try:
        # Confirmed = human kept AI decision (was_overridden = False)
        confirmed_resp = supabase.table("escalation_feedback").select(
            "id", count="exact"
        ).eq("human_team", team).eq("human_level", level).eq(
            "was_overridden", False
        ).execute()

        # Corrected = human changed AI decision (was_overridden = True)
        corrected_resp = supabase.table("escalation_feedback").select(
            "id", count="exact"
        ).eq("ai_team", team).eq("ai_level", level).eq(
            "was_overridden", True
        ).execute()

        return {
            "confirmed": confirmed_resp.count or 0,
            "corrected": corrected_resp.count or 0,
        }

    except Exception as e:
        print(f"[EscalationRepo] ⚠️  get_feedback_counts failed: {e}")
        return {"confirmed": 0, "corrected": 0}