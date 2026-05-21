# app/v1/priority_sla_routes.py
# ─────────────────────────────────────────────────────────────────────────────
# Two route groups:
#   POST /api/priority-sla/assess        → run the full flow on a ticket dict
#   POST /api/priority-sla/hitl-submit   → human submits extra info for P1/P2
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from modules.priority_sla.handler import handle_priority_sla_flow
from modules.priority_sla.service import (
    get_priority,
    get_sla,
    requires_human_review,
    VALID_IMPACTS,
    VALID_URGENCIES,
)
from repositories.priority_sla_repository import update_ticket_priority_sla
from repositories.ticket_event_repository import log_event

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class PrioritySLARequest(BaseModel):
    issue_key:      str
    summary:        str
    description:    str = ""
    app_name:       Optional[str] = ""
    component_name: Optional[str] = ""
    impact:         str
    urgency:        str


class HITLSubmitRequest(BaseModel):
    """
    Sent by the frontend when the human fills in the HITL popup (P1/P2 only).
    Fields here are whatever extra details your manager wants captured.
    """
    issue_key:           str
    priority:            str           # P1 or P2 (for validation)
    approver_name:       Optional[str] = ""
    business_justification: Optional[str] = ""
    affected_teams:      Optional[str] = ""
    escalation_path:     Optional[str] = ""
    comments:            Optional[str] = ""


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/priority-sla/assess
# Stand-alone endpoint to run priority+SLA assessment on demand.
# The orchestrator calls handle_priority_sla_flow() directly,
# but this endpoint is useful for testing and for the frontend to
# trigger a re-assessment without resubmitting the full ticket.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/priority-sla/assess")
async def assess_priority_sla(payload: PrioritySLARequest):
    """
    Runs impact/urgency revalidation + priority+SLA assignment.
    Returns the full assessment result including HITL flag.
    """
    try:
        # Build a minimal state dict (same shape the orchestrator uses)
        state = {
            "id":       payload.issue_key,
            "summary":  payload.summary,
            "data": {
                "description":    payload.description,
                "app_name":       payload.app_name,
                "component_name": payload.component_name,
                "impact":         payload.impact,
                "urgency":        payload.urgency,
            },
            "is_duplicate": False,
        }

        result = await handle_priority_sla_flow(state)

        await log_event(
            ticket_id = payload.issue_key,
            event     = "PRIORITY_SLA_ASSIGNED",
            actor     = "system",
            details   = (
                f"priority={result.get('priority')} | "
                f"impact={result.get('revalidated_impact')} | "
                f"urgency={result.get('revalidated_urgency')}"
            ),
        )

        return {
            "type":    "success",
            "issue_key": payload.issue_key,

            # original user values
            "user_impact":   payload.impact,
            "user_urgency":  payload.urgency,

            # revalidated
            "revalidated_impact":         result.get("revalidated_impact"),
            "revalidated_urgency":        result.get("revalidated_urgency"),
            "impact_changed":             result.get("impact_changed", False),
            "urgency_changed":            result.get("urgency_changed", False),

            # confidence
            "impact_confidence":          result.get("impact_confidence"),
            "urgency_confidence":         result.get("urgency_confidence"),
            "impact_confidence_label":    result.get("impact_confidence_label"),
            "urgency_confidence_label":   result.get("urgency_confidence_label"),

            # priority + SLA
            "priority":                   result.get("priority"),
            "sla_response_time":          result.get("sla_response_time"),
            "sla_resolution_time":        result.get("sla_resolution_time"),
            "sla_description":            result.get("sla_description"),

            # HITL
            "requires_human_review":      result.get("requires_human_review", False),

            # rationale
            "rationale": result.get("priority_sla_rationale", {}),
        }

    except Exception as e:
        print(f"❌ assess_priority_sla error: {e}")
        return {"type": "error", "message": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/priority-sla/hitl-submit
# Called when the human fills in the HITL popup and clicks Submit.
# Logs the submission and marks the ticket as HITL-reviewed.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/priority-sla/hitl-submit")
async def hitl_submit(payload: HITLSubmitRequest):
    """
    Receives human-in-the-loop details for P1/P2 tickets.
    Logs the event so the timeline shows human review occurred.
    """
    try:
        if payload.priority not in ("P1", "P2"):
            return {
                "type": "error",
                "message": "HITL submission is only valid for P1 or P2 tickets."
            }

        details = (
            f"approver={payload.approver_name} | "
            f"teams={payload.affected_teams} | "
            f"justification={payload.business_justification[:120] if payload.business_justification else ''}"
        )

        await log_event(
            ticket_id = payload.issue_key,
            event     = "HITL_SUBMITTED",
            actor     = payload.approver_name or "human",
            details   = details,
        )

        # Optionally mark the ticket as HITL-reviewed in the DB
        # (add a hitl_reviewed column to tickets if needed)
        from repositories.ticket_repository import supabase as ticket_db
        ticket_db.table("tickets").update({
            "hitl_reviewed":           True,
            "hitl_approver":           payload.approver_name,
            "hitl_business_justification": payload.business_justification,
            "hitl_affected_teams":     payload.affected_teams,
            "hitl_escalation_path":    payload.escalation_path,
            "hitl_comments":           payload.comments,
        }).eq("issue_key", payload.issue_key).execute()

        return {
            "type":    "success",
            "message": f"HITL review recorded for {payload.issue_key}.",
            "issue_key": payload.issue_key,
        }

    except Exception as e:
        print(f"❌ hitl_submit error: {e}")
        return {"type": "error", "message": str(e)}
