# routers/sop_router.py

from fastapi import APIRouter, HTTPException

from repositories.ticket_repository import (
    get_all_tickets,
    update_ticket_sop,
)
from modules.sop_execution.handler import handle_sop_flow
from repositories.ticket_event_repository import log_event

router = APIRouter()


# ───────────── GET SOP FOR TICKET ─────────────
@router.get("/tickets/{issueKey}/sop")
async def get_sop(issueKey: str):
    try:
        tickets = await get_all_tickets()
        ticket  = next((t for t in tickets if t["issue_key"] == issueKey), None)

        if not ticket:
            raise HTTPException(status_code=404, detail=f"Ticket {issueKey} not found")

        # ── child ticket → redirect to parent ──
        if ticket.get("is_duplicate") and ticket.get("parent_ticket_key"):
            parent_key = ticket["parent_ticket_key"]
            print(f"↩️  [{issueKey}] Duplicate — redirecting to parent {parent_key}")
            return {
                "type":              "duplicate",
                "message":           f"This is a duplicate ticket. See SOP for parent: {parent_key}",
                "parent_ticket_key": parent_key,
            }

        # ─────────────────────────────
        # CACHE HIT — SOP matched
        # ─────────────────────────────
        if ticket.get("paired_steps"):
            print(f"📦 [{issueKey}] CACHE HIT — SOP already matched")
            return {
                "paired_steps":   ticket["paired_steps"],
                "sop_title":      ticket.get("sop_title"),
                "sop_code":       ticket.get("sop_code"),
                "app_code":       ticket.get("app_code"),
                "component_code": ticket.get("component_code"),
                "sop_match_type": ticket.get("sop_match_type"),
                "ticket_status":  ticket.get("status"),
                "message":        "Loaded from cache",
            }

        # ─────────────────────────────
        # CACHE HIT — previously no SOP found
        # ─────────────────────────────
        if ticket.get("sop_match_type") == "no_sop_found":
            print(f"📦 [{issueKey}] CACHE HIT — no SOP found previously, skipping agent")
            return {
                "paired_steps":   [],
                "sop_title":      None,
                "sop_code":       None,
                "app_code":       None,
                "component_code": None,
                "sop_match_type": "no_sop_found",
                "ticket_status":  ticket.get("status"),
                "message":        "No matching SOP found. Please escalate for manual triage.",
            }

        # ─────────────────────────────
        # CACHE MISS → RUN AGENT
        # ─────────────────────────────
        print(f"🤖 [{issueKey}] CACHE MISS — running SOP agent...")

        state = {
            "id":          issueKey,
            "summary":     ticket.get("summary", ""),
            "description": ticket.get("description", ""),
            "data":        ticket,
            "type":        None,
            "message":     "",
        }

        result = await handle_sop_flow(state)

        if result.get("type") == "error":
            raise HTTPException(status_code=500, detail=result.get("message"))

        # ── No SOP matched — cache the miss so agent doesn't re-run ──
        if result.get("type") == "sop_not_found":
            await update_ticket_sop(
                issueKey,
                paired_steps   = [],
                sop_title      = None,
                sop_code       = None,
                app_code       = None,
                component_code = None,
                sop_match_type = "no_sop_found",
            )
            await log_event(
                ticket_id=issueKey,
                event="SOP_NOT_FOUND",
                actor="system",
                details="No matching SOP found — manual review required",
                metadata={"sop_match_type": "no_sop_found"},
            )
            print(f"📝 [{issueKey}] no_sop_found written to DB")
            return {
                "paired_steps":   [],
                "sop_title":      None,
                "sop_code":       None,
                "app_code":       None,
                "component_code": None,
                "sop_match_type": "no_sop_found",
                "ticket_status":  ticket.get("status"),
                "message":        result.get("message"),
            }

        paired_steps = result.get("paired_steps", [])

        # ── Cache in DB ──
        await update_ticket_sop(
            issueKey,
            paired_steps   = paired_steps,
            sop_title      = result.get("sop_title"),
            sop_code       = result.get("sop_code"),
            app_code       = result.get("app_code"),
            component_code = result.get("component_code"),
            sop_match_type = result.get("sop_match_type"),
        )
        await log_event(
            ticket_id=issueKey,
            event="SOP_GENERATED",
            actor="system",
            details="SOP matched from Confluence and cached",
            metadata={
                "sop_title":      result.get("sop_title"),
                "sop_code":       result.get("sop_code"),
                "app_code":       result.get("app_code"),
                "component_code": result.get("component_code"),
                "sop_match_type": result.get("sop_match_type"),
            }
        )
        print(f"💾 [{issueKey}] SOP cached in Supabase")

        return {
            "paired_steps":   paired_steps,
            "sop_title":      result.get("sop_title"),
            "sop_code":       result.get("sop_code"),
            "app_code":       result.get("app_code"),
            "component_code": result.get("component_code"),
            "sop_match_type": result.get("sop_match_type"),
            "ticket_status":  ticket.get("status"),
            "message":        result.get("message"),
        }

    except HTTPException:
        raise

    except Exception as e:
        print(f"❌ get_sop error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ───────────── GET COMPLETION ELIGIBILITY ─────────────
@router.get("/tickets/{issueKey}/can-complete")
async def can_complete_ticket(issueKey: str):
    try:
        tickets = await get_all_tickets()
        ticket = next((t for t in tickets if t["issue_key"] == issueKey), None)

        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        children = [
            t for t in tickets
            if t.get("parent_ticket_key") == issueKey
        ]

        open_children = [
            c["issue_key"]
            for c in children
            if c.get("status") != "Completed"
        ]

        return {
            "allowed":       len(open_children) == 0,
            "open_children": open_children,
        }

    except Exception as e:
        print(f"❌ can_complete_ticket error: {e}")
        raise HTTPException(status_code=500, detail=str(e))