from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from repositories.ticket_repository import (
    get_all_tickets,
    update_ticket_escalation_v2,
)
from repositories.escalation_repository import (
    log_escalation_feedback,
    increment_kb_confirmed,
    increment_kb_corrected,
    search_escalation_kb,
)
from modules.smart_escalation.handler import handle_smart_escalation
from services.embedding_service import get_embedding


router = APIRouter()


# ─────────────────────────────────────────────────────────────
# SCHEMA: Human Feedback / Review Form
# ─────────────────────────────────────────────────────────────

class EscalationFeedbackRequest(BaseModel):
    human_team:   str           # Which team the human selected
    human_level:  str           # L1 / L2 / L3
    human_reason: str           # Why they kept or changed AI decision
    review_type:  str = "hitl_review"  # "hitl_review" | "quarantine_review"


# ─────────────────────────────────────────────────────────────
# POST /tickets/{issueKey}/escalate
# ─────────────────────────────────────────────────────────────

@router.post("/tickets/{issueKey}/escalate")
async def escalate_ticket(issueKey: str):

    tickets = await get_all_tickets()
    ticket  = next((t for t in tickets if t["issue_key"] == issueKey), None)

    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {issueKey} not found")

    if ticket.get("status") == "Completed":
        raise HTTPException(
            status_code=400,
            detail="Cannot escalate a completed ticket."
        )

    # Idempotent: if already escalated and not quarantine, return existing result
    if ticket.get("esc_action") and ticket["esc_action"] not in ("QUARANTINE", None):
        return {
            "success":           True,
            "already_escalated": True,
            "issue_key":         issueKey,
            "esc_team":          ticket.get("esc_team"),
            "esc_level":         ticket.get("esc_level"),
            "esc_confidence":    ticket.get("esc_confidence"),
            "esc_action":        ticket.get("esc_action"),
            "esc_rationale":     ticket.get("esc_rationale"),
            "escalated_at":      ticket.get("escalated_at"),
            "message":           f"Ticket {issueKey} was already escalated.",
        }

    # Build state dict matching handler's expected format
    state = {
        "id":      issueKey,
        "summary": ticket.get("summary", ""),
        "data": {
            "description": ticket.get("description", ""),
            "issue_key":   issueKey,
        },
    }

    result = await handle_smart_escalation(state)

    if result.get("type") == "error":
        raise HTTPException(
            status_code=500,
            detail=result.get("message", "Escalation failed")
        )

    print(
        f"[EscalationRoute] ✅ {issueKey} → "
        f"team={result['esc_team']} | level={result['esc_level']} | "
        f"action={result['esc_action']}"
    )

    return {
        "success":            True,
        "issue_key":          issueKey,
        "esc_team":           result["esc_team"],
        "esc_level":          result["esc_level"],
        "esc_confidence":     result["esc_confidence"],
        "esc_confidence_raw": result.get("esc_confidence_raw"),
        "esc_action":         result["esc_action"],
        "esc_rationale":      result["esc_rationale"],
        "escalated_at":       result["escalated_at"],
    }


# ─────────────────────────────────────────────────────────────
# POST /tickets/{issueKey}/escalation-feedback
# ─────────────────────────────────────────────────────────────

@router.post("/tickets/{issueKey}/escalation-feedback")
async def submit_escalation_feedback(issueKey: str, body: EscalationFeedbackRequest):

    tickets = await get_all_tickets()
    ticket  = next((t for t in tickets if t["issue_key"] == issueKey), None)

    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {issueKey} not found")

    ai_team       = ticket.get("esc_team")
    ai_level      = ticket.get("esc_level")
    ai_confidence = ticket.get("esc_confidence")

    human_team    = body.human_team.strip()
    human_level   = body.human_level.strip().upper()
    human_reason  = body.human_reason.strip()
    review_type   = body.review_type

    if not human_team or not human_level or not human_reason:
        raise HTTPException(
            status_code=422,
            detail="human_team, human_level, and human_reason are all required."
        )

    if human_level not in ("L1", "L2", "L3"):
        raise HTTPException(
            status_code=422,
            detail=f"human_level must be L1, L2, or L3. Got: {human_level}"
        )

    # Did the human override the AI's decision?
    was_overridden = (
        ai_team  != human_team  or
        ai_level != human_level
    )

    # ── Save feedback log ──
    await log_escalation_feedback(
        ticket_key     = issueKey,
        ai_team        = ai_team,
        ai_level       = ai_level,
        ai_confidence  = ai_confidence,
        human_team     = human_team,
        human_level    = human_level,
        human_reason   = human_reason,
        was_overridden = was_overridden,
        review_type    = review_type,
    )

    # ── Update ticket with human's final decision ──
    now = datetime.now(timezone.utc).isoformat()

    await update_ticket_escalation_v2(
        issue_key      = issueKey,
        esc_team       = human_team,
        esc_level      = human_level,
        esc_confidence = ai_confidence or "HUMAN_REVIEWED",
        esc_action     = "HUMAN_FINALISED",
        esc_rationale  = human_reason,
        escalated_at   = now,
    )

    # ── KB self-learning: find closest KB row and update counters ──
    # This is what keeps the "document" updated over time.
    incident_text = f"{ticket.get('summary', '')} {ticket.get('description', '')}".strip()

    if incident_text:
        embedding = await get_embedding(incident_text)

        if embedding:
            embedding  = [float(x) for x in embedding]
            kb_matches = await search_escalation_kb(embedding, top_k=1, min_similarity=0.35)

            if kb_matches:
                top_kb_id = kb_matches[0]["id"]

                if was_overridden:
                    await increment_kb_corrected(top_kb_id)
                    print(
                        f"[EscalationRoute] 📚 KB row {top_kb_id} "
                        f"corrected_count incremented (human overrode AI)"
                    )
                else:
                    await increment_kb_confirmed(top_kb_id)
                    print(
                        f"[EscalationRoute] 📚 KB row {top_kb_id} "
                        f"confirmed_count incremented (human agreed with AI)"
                    )

    print(
        f"[EscalationRoute] ✅ Feedback saved for {issueKey} | "
        f"overridden={was_overridden} | final={human_team}/{human_level}"
    )

    return {
        "success":        True,
        "issue_key":      issueKey,
        "was_overridden": was_overridden,
        "final_team":     human_team,
        "final_level":    human_level,
        "final_action":   "HUMAN_FINALISED",
        "saved_at":       now,
    }


# ─────────────────────────────────────────────────────────────
# GET /tickets/{issueKey}/escalation-result
# ─────────────────────────────────────────────────────────────

@router.get("/tickets/{issueKey}/escalation-result")
async def get_escalation_result(issueKey: str):

    tickets = await get_all_tickets()
    ticket  = next((t for t in tickets if t["issue_key"] == issueKey), None)

    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {issueKey} not found")

    return {
        "issue_key":      issueKey,
        "esc_team":       ticket.get("esc_team"),
        "esc_level":      ticket.get("esc_level"),
        "esc_confidence": ticket.get("esc_confidence"),
        "esc_action":     ticket.get("esc_action"),
        "esc_rationale":  ticket.get("esc_rationale"),
        "escalated_at":   ticket.get("escalated_at"),
    }