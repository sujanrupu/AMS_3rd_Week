from modules.duplicate_detection.handler import handle_duplicate_flow
from modules.copilot_rca.handler import handle_rca_flow
from modules.priority_sla.handler import handle_priority_sla_flow
from modules.sop_execution.handler import handle_sop_flow
from repositories.ticket_event_repository import log_event


async def handle_ticket(data):

    state = {
        "data": data,
        "timeline_started": True,
        "summary": getattr(data, "summary", "") if data else "",
        "issue_key": getattr(data, "issue_key", None),
        
        "type": None,
        "id": None,
        "message": None,
        "is_duplicate": False,

        "rca_root_cause": None,
        "rca_affected": None,
        "rca_confidence": None,
        "rca_confidence_label": None,
        "rca_summary": None,
    }

    try:
        # -------------------------------------------------
        # STEP 0: DUPLICATE CHECK
        # -------------------------------------------------
        state = await safe_run_module(handle_duplicate_flow, state)

        ticket_id = state.get("id") or state.get("issue_key")

        # -------------------------------------------------
        # INIT LOGS
        # -------------------------------------------------
        if ticket_id:
            await log_event(
                ticket_id=ticket_id,
                event="TICKET_SUBMITTED",
                actor="user",
                details=state.get("summary", "")
            )

            await log_event(
                ticket_id=ticket_id,
                event="DUPLICATE_DETECTION_COMPLETED"
            )

        if not state.get("summary") and state.get("data"):
            data_obj = state["data"]
            state["summary"] = getattr(data_obj, "summary", "")

        # -------------------------------------------------
        # EXIT IF DUPLICATE
        # -------------------------------------------------
        if state.get("is_duplicate"):
            if ticket_id:
                await log_event(
                    ticket_id=ticket_id,
                    event="DUPLICATE_DETECTED"
                )

            print(
                f"[Orchestrator] Duplicate ticket "
                f"{ticket_id} will continue for Priority/SLA assignment"
            )


        # -------------------------------------------------
        #  PRIORITY + SLA ASSIGNMENT
        # -------------------------------------------------
        state = await safe_run_module(handle_priority_sla_flow, state)

        ticket_id = state.get("id") or state.get("issue_key")

        if ticket_id:
            await log_event(
                ticket_id=ticket_id,
                event="PRIORITY_SLA_ASSIGNED",
                actor="system",
                details=(
                    f"priority={state.get('priority')} | "
                    f"impact={state.get('revalidated_impact')} | "
                    f"urgency={state.get('revalidated_urgency')}"
                )
            )


        # ── STEP 1: RCA GENERATION ──
        state = await safe_run_module(handle_rca_flow, state)
        ticket_id = state.get("id") or state.get("issue_key")

        if ticket_id:
            try:
                await log_event(ticket_id=ticket_id, event="RCA_GENERATED",
                                actor="system",
                                details=f"confidence={state.get('rca_confidence')}")
            except Exception as e:
                print(f"⚠️ RCA log_event failed: {e}")
        
         # -------------------------------------------------
        # SOP EXECUTION
        # -------------------------------------------------
        state = await safe_run_module(handle_sop_flow, state)

        ticket_id = state.get("id") or state.get("issue_key")

        # =================================================
        # SINGLE SOP LOG (ONLY ONCE PER TICKET)
        # =================================================
        if ticket_id:
            try:
                await log_event(
                    ticket_id=ticket_id,
                    event="SOP_EXECUTED",
                    actor="system",
                    details=f"resolution steps generated"
                )
            except Exception as e:
                print(f"⚠️ SOP log_event failed: {e}")

        # -------------------------------------------------
        # RETURN FINAL RESPONSE
        # -------------------------------------------------
        return normalize_response(state)

    except Exception as e:
        return {
            "type": "error",
            "message": f"Orchestrator failed: {str(e)}"
        }


async def safe_run_module(module_fn, state: dict):
    try:
        result = await module_fn(state)

        if not isinstance(result, dict):
            return {
                **state,
                "type": "error",
                "message": "Module returned invalid state"
            }

        state.update(result)
        return state

    except Exception as e:
        return {
            **state,
            "type": "error",
            "message": f"Module failed: {str(e)}"
        }


def normalize_response(state: dict):
    return {
        "type": state.get("type", "success"),
        "id": state.get("id"),
        "message": state.get("message"),

        "priority_sla": {
            "priority":               state.get("priority"),
            "revalidated_impact":     state.get("revalidated_impact"),
            "revalidated_urgency":    state.get("revalidated_urgency"),
            "impact_changed":         state.get("impact_changed", False),
            "urgency_changed":        state.get("urgency_changed", False),
            "impact_confidence":      state.get("impact_confidence"),
            "urgency_confidence":     state.get("urgency_confidence"),
            "sla_response_time":      state.get("sla_response_time"),
            "sla_resolution_time":    state.get("sla_resolution_time"),
            "sla_description":        state.get("sla_description"),
            "requires_human_review":  state.get("requires_human_review", False),
            "rationale":              state.get("priority_sla_rationale", {}),
        } if state.get("priority") else None,
        "rca": {
            "root_cause": state.get("rca_root_cause"),
            "affected": state.get("rca_affected"),
            "confidence": state.get("rca_confidence"),
            "confidence_label": state.get("rca_confidence_label"),
            "summary": state.get("rca_summary"),
        } if state.get("rca_root_cause") else None,
    }