# app/v1/ticket_routes.py

from fastapi import APIRouter, HTTPException

# schemas + orchestrator
from schemas.ticket_schema import TicketRequest
from orchestrator.ams_orchestrator import handle_ticket
from repositories.ticket_repository import search_similar_tickets
from services.embedding_service import get_embedding

# repository layer
# repository layer
from repositories.ticket_repository import (
    get_all_tickets,
    update_status_cascade,
    get_ticket,
    get_children,
    update_parent,
    update_child_keys,
    promote_first_child_as_parent
)

# Jira integration
from services.jira_service import (
    complete_parent_and_children,
    unlink_duplicate_comments,
    unlink_jira_issues
)


from services.merge_service import merge_tickets

from modules.pre_submission_search.handler import (
    search_similar_completed_tickets
)
from repositories.ticket_event_repository import log_event
from services.app_service import get_apps_with_components

router = APIRouter()


# ─────────────────────────────────────────────
# SUBMIT TICKET
# ─────────────────────────────────────────────
@router.post("/submit")
async def submit(data: TicketRequest):

    result = await handle_ticket(data)

    if not isinstance(result, dict):
        return {
            "type": "error",
            "message": "Invalid orchestrator response"
        }

    return result


# ─────────────────────────────────────────────
# GET ALL TICKETS
# ─────────────────────────────────────────────
@router.get("/tickets")
async def get_tickets():
     
    tickets = await get_all_tickets()

    if not isinstance(tickets, list):
        return []

    return tickets


# ─────────────────────────────────────────────
# COMPLETE CHECK
# ─────────────────────────────────────────────
@router.get("/tickets/{issueKey}/complete-check")
async def check_before_complete(issueKey: str):
    tickets = await get_all_tickets()
    current = next((t for t in tickets if t["issue_key"] == issueKey), None)
    if not current:
        return {"type": "error", "message": "Ticket not found"}

    parent_key    = current.get("parent_ticket_key") or current["issue_key"]
    children      = [t for t in tickets if t.get("parent_ticket_key") == parent_key]
    open_children = [c["issue_key"] for c in children if c.get("status") != "Completed"]

    if open_children:
        return {
            "type":                  "warning",
            "requires_confirmation": True,
            "parent_key":            parent_key,
            "open_children":         open_children,
            "message":               "Some children are still open",
        }
    return {"type": "safe", "parent_key": parent_key, "message": "Safe to complete"}


# ─────────────────────────────────────────────
# COMPLETE TICKET CASCADE
# ─────────────────────────────────────────────
@router.put("/tickets/{issueKey}/complete")
async def complete_ticket(issueKey: str, force: bool = False):
    try:
        tickets = await get_all_tickets()
        if not tickets:
            return {"type": "error", "message": "No tickets found"}

        current = next((t for t in tickets if t["issue_key"] == issueKey), None)
        if not current:
            return {"type": "error", "message": "Ticket not found"}

        parent_key    = current.get("parent_ticket_key") or current.get("issue_key")
        children      = [t for t in tickets if t.get("parent_ticket_key") == parent_key]
        open_children = [c for c in children if c.get("status") != "Completed"]

        if open_children and not force:
            return {
                "type":                  "warning",
                "message":               "Some child tickets are still open",
                "requires_confirmation": True,
                "parent_key":            parent_key,
                "open_children":         [c["issue_key"] for c in open_children],
            }

        print(f"🔍 Completing parent + children: {parent_key}")

        jira_ok = await complete_parent_and_children(parent_key)
        if not jira_ok:
            print(f"⚠️ Jira cascade update partially failed for {parent_key}")

        db_ok = await update_status_cascade(parent_key, "Completed")
        await log_event(
            ticket_id=parent_key,
            event="PARENT_COMPLETED",
            actor="system",
            details="Parent and all children marked completed",
        )

        if not db_ok:
            return {"type": "error", "message": "Database update failed"}

        print(f"✅ Completed parent + all child tickets for {parent_key}")
        return {
            "type":    "success",
            "message": "Parent and all child tickets marked completed",
            "id":      parent_key,
        }

    except Exception as e:
        print(f"❌ complete_ticket error: {e}")
        return {"type": "error", "message": str(e)}

# ─────────────────────────────────────────────
# GET TICKET BY ISSUE KEY (PARENT ONLY)
# USED FOR SEARCH BAR
# ─────────────────────────────────────────────
import re


@router.get("/tickets/search/{issueKey}")
async def search_by_id(issueKey: str):

    try:

        tickets = await get_all_tickets()

        if not tickets:
            return {
                "type": "error",
                "message": "No tickets found"
            }

        key = issueKey.strip().upper()

        # ─────────────────────────────
        # STEP 1: FIND EXACT TICKET
        # ─────────────────────────────
        current = next(
            (
                t for t in tickets
                if t["issue_key"].upper() == key
            ),
            None
        )

        if not current:
            return {
                "type": "error",
                "message": "Ticket not found"
            }

        # ─────────────────────────────
        # STEP 2: CHILD TICKET FLOW
        # ─────────────────────────────
        if current.get("child_key"):

            parent_key = current["parent_ticket_key"]

            parent = next(
                (
                    t for t in tickets
                    if t["issue_key"] == parent_key
                ),
                None
            )

            if not parent:
                return {
                    "type": "error",
                    "message": "Parent ticket not found"
                }

            children = [
                t for t in tickets
                if t.get("parent_ticket_key") == parent_key
            ]

            return {
                "type": "success",

                # IMPORTANT ORDER FOR UI
                "child": current,          # show first
                "parent_key": parent_key,  # display label
                "parent": parent,          # full card
                "children": children,

                "mode": "child-view"
            }

        # ─────────────────────────────
        # STEP 3: PARENT FLOW
        # ─────────────────────────────
        children = [
            t for t in tickets
            if t.get("parent_ticket_key") == current["issue_key"]
        ]

        return {
            "type": "success",
            "parent": current,
            "children": children,
            "mode": "parent-view"
        }

    except Exception as e:

        print(f"❌ search_by_id error: {e}")

        return {
            "type": "error",
            "message": str(e)
        }



# ─────────────────────────────────────────────
# MERGE OPTIONS / PREVIEW
# called when user clicks merge button
# ─────────────────────────────────────────────
@router.get("/tickets/{issueKey}/merge-options")
async def get_merge_options(issueKey: str):

    try:

        tickets = await get_all_tickets()

        current = next(
            (
                t for t in tickets
                if t["issue_key"] == issueKey
            ),
            None
        )

        if not current:
            return {
                "type":"error",
                "message":"Ticket not found"
            }

        # prevent children
        if current.get("parent_ticket_key"):

            parent_key = current["parent_ticket_key"]

            return {
                "type":"warning",
                "message":"Child ticket selected",
                "parent_key": parent_key,
                "use_parent":True
            }

        available = [

            {
                "issue_key":t["issue_key"],
                "summary":t.get("summary"),
                "status":t.get("status")
            }

            for t in tickets

            if (
                t["issue_key"] != issueKey
                and not t.get("parent_ticket_key")
            )
        ]

        return {

            "type":"success",

            "ticket":current,

            "merge_modes":[
                {
                    "id":"merge_into_this",
                    "label":"Merge other tickets into this"
                },
                {
                    "id":"merge_with_other",
                    "label":"Merge this ticket with another"
                }
            ],

            "candidates":available
        }

    except Exception as e:

        return {
            "type":"error",
            "message":str(e)
        }


@router.post("/tickets/merge")
async def merge_tickets_api(payload: dict):

    try:

        mode=payload.get("mode")

        current=payload.get(
            "current_ticket"
        )

        selected=payload.get(
            "selected_tickets",
            []
        )

        if not current:

            return {
                "type":"error",
                "message":"Current missing"
            }

        if not selected:

            return {
                "type":"error",
                "message":"No selected tickets"
            }

        # current becomes target
        if mode=="merge_into_this":

            target=current
            sources=selected

        # current becomes source
        elif mode=="merge_with_other":

            target=selected[0]

            sources=[
                current
            ]

        else:

            return {
                "type":"error",
                "message":"Invalid mode"
            }

        result=await merge_tickets(
            target_parent=target,
            source_parents=sources
        )

        return {
            "type":"success",
            "data":result
        }

    except Exception as e:

        return {
            "type":"error",
            "message":str(e)
        }


@router.put("/tickets/{issueKey}/detach")
async def detach_ticket(issueKey: str):

    try:

        tickets = await get_all_tickets()

        current = next(
            (
                t for t in tickets
                if t["issue_key"] == issueKey
            ),
            None
        )

        if not current:
            return {
                "type": "error",
                "message": "Ticket not found"
            }

        # only child tickets can be detached
        if not current.get("parent_ticket_key"):
            return {
                "type": "error",
                "message": "Only child tickets can be detached"
            }

        from repositories.ticket_repository import (
            detach_child_ticket
        )

        parent_key = current[
            "parent_ticket_key"
        ]

        # remove Jira comment links
        await unlink_duplicate_comments(
            parent_key,
            issueKey
        )
        await unlink_jira_issues(
            parent_key,
            issueKey
        )

        # detach DB relationship
        ok = await detach_child_ticket(
            issueKey
        )
        # Child perspective
        await log_event(
            ticket_id=issueKey,
            event="DETACHED_FROM_PARENT",
            actor="system",
            details=f"Detached from parent {parent_key}"
        )

        # Parent perspective (important for traceability)
        await log_event(
            ticket_id=parent_key,
            event="CHILD_DETACHED",
            actor="system",
            details=f"Child {issueKey} detached"
        )

        if not ok:
            return {
                "type": "error",
                "message": "Detach failed"
            }

        return {
            "type": "success",
            "message":
                "Ticket detached successfully",
            "id": issueKey
        }

    except Exception as e:

        print(
            f"❌ detach_ticket error: {e}"
        )

        return {
            "type": "error",
            "message": str(e)
        }   




# ─────────────────────────────────────────────
# COMPLETE ONLY ONE TICKET
# ─────────────────────────────────────────────
@router.put("/tickets/{issueKey}/complete-single")
async def complete_single_ticket(issueKey: str):

    try:

        from repositories.ticket_repository import (
            get_ticket
        )

        ticket = await get_ticket(issueKey)

        if not ticket:
            return {
                "type":"error",
                "message":"Ticket not found"
            }

        from services.jira_service import (
            update_jira_status
        )

        jira_ok = await update_jira_status(
            issueKey
        )

        if not jira_ok:

            return {
                "type":"error",
                "message":"Jira update failed"
            }

        from repositories.ticket_repository import (
            supabase
        )

        supabase.table(
            "tickets"
        ).update({
            "status":"Completed"
        }).eq(
            "issue_key",
            issueKey
        ).execute()

        await log_event(
            ticket_id=issueKey,
            event="SINGLE_COMPLETED",
            actor="system",
            details="Single ticket marked completed"
        )

        return {
            "type":"success",
            "message":"Single ticket completed"
        }

    except Exception as e:

        return {
            "type":"error",
            "message":str(e)
        }



@router.post("/tickets/pre-search")
async def pre_submission_search(payload: dict):

    summary = payload.get("summary", "")
    description = payload.get("description", "")

    app_name = payload.get("app_name", "")
    component_name = payload.get("component_name", "")

    if not summary:
        return {"ticket": None}

    result = await search_similar_completed_tickets(
        summary,
        description,
        app_name,
        component_name
    )

    print("\nPRE SEARCH API RESPONSE:", result, "\n")

    return result


# ─────────────────────────────────────────────
# COMPLETE ONLY CHILDREN OF A PARENT
# Parent remains unchanged
# ─────────────────────────────────────────────
@router.put("/tickets/{issueKey}/complete-children")
async def complete_children_only(issueKey: str):

    try:

        ticket = await get_ticket(issueKey)

        if not ticket:
            return {
                "type":"error",
                "message":"Ticket not found"
            }

        parent_key = (
            ticket.get("parent_ticket_key")
            or ticket["issue_key"]
        )

        children = await get_children(
            parent_key
        )

        if not children:
            return {
                "type":"error",
                "message":"No child tickets found"
            }

        from services.jira_service import (
            update_jira_status
        )

        from repositories.ticket_repository import (
            update_children_status
        )

        # Jira only for children
        for child in children:

            await update_jira_status(
                child["issue_key"]
            )

        db_ok = await update_children_status(
            parent_key,
            "Completed"
        )
        await log_event(
            ticket_id=parent_key,
            event="CHILDREN_COMPLETED",
            actor="system",
            details="All child tickets completed"
        )

        if not db_ok:
            return {
                "type":"error",
                "message":"DB update failed"
            }

        return {
            "type":"success",
            "message":"All child tickets completed"
        }

    except Exception as e:

        print(
            "❌ complete_children_only:",
            e
        )

        return {
            "type":"error",
            "message":str(e)
        }



@router.get("/apps-with-components")
async def apps_with_components():
    try:
        data = await get_apps_with_components()

        return {
            "type": "success",
            "data": data
        }

    except Exception as e:
        return {
            "type": "error",
            "message": str(e)
        }



# ─────────────────────────────────────────────
# CREATE P4 JIRA TICKET FOR MISSING SOP
# Inserts a brand-new ticket row with sop_parent_key set.
# Drop-in replacement for the existing route in ticket_routes.py
# ─────────────────────────────────────────────
@router.post("/tickets/{issueKey}/create-sop-reminder")
async def create_sop_reminder(issueKey: str):
    try:
        ticket = await get_ticket(issueKey)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        app_name       = ticket.get("app_name", "General")
        component_name = ticket.get("component_name", "General")

        jira_data = {
            "summary":        f"[SOP Required] Create SOP for {app_name} - {component_name}",
            "description":    (
                f"No SOP was found for {app_name} / {component_name}. "
                f"Please create one.\n\nOriginal ticket: {issueKey}\n"
                f"Issue Summary: {ticket.get('summary', '')}"
            ),
            "app_name":       app_name,
            "component_name": component_name,
            "urgency":        "Low",
            "impact":         "Minor",
        }

        jira_res = await create_ticket(jira_data)
        if not jira_res:
            raise HTTPException(status_code=500, detail="Failed to create Jira reminder ticket")

        print(f"🔍 [{issueKey}] Jira reminder raw response: {jira_res}")

        jira_key = (
            jira_res.get("issueKey")
            or (jira_res.get("issue") or {}).get("key")
            or (jira_res.get("issue") or {}).get("id")
            or jira_res.get("key")
            or ""
        )

        if not jira_key:
            print(f"⚠️ [{issueKey}] Could not extract Jira key: {jira_res}")
            await log_event(
                ticket_id=issueKey,
                event="SOP_REMINDER_CREATED",
                actor="user",
                details="P4 Jira ticket created but key could not be extracted",
                metadata={"raw_response": str(jira_res)},
            )
            return {"ok": True, "jira_key": None, "warning": "Jira ticket created but key not captured"}

        print(f"✅ [{issueKey}] P4 reminder Jira key: {jira_key}")

        # ── INSERT NEW TICKET ROW ──
        inserted = await insert_sop_reminder_ticket(
            jira_key       = jira_key,
            sop_parent_key = issueKey,
            app_name       = app_name,
            component_name = component_name,
            app_code       = ticket.get("app_code"),
            component_code = ticket.get("component_code"),
        )

        if not inserted:
            print(f"⚠️ [{issueKey}] insert_sop_reminder_ticket returned None")

        await log_event(
            ticket_id=issueKey,
            event="SOP_REMINDER_CREATED",
            actor="user",
            details=f"P4 SOP reminder ticket created: {jira_key}",
            metadata={"reminder_ticket": jira_key},
        )

        jira_url = f"{__import__('os').environ.get('JIRA_BASE_URL', '')}/browse/{jira_key}"

        return {"ok": True, "jira_key": jira_key, "jira_url": jira_url}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ create_sop_reminder error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ─────────────────────────────────────────────
# CREATE SOP — push to Confluence + embed
# Called when agent clicks "Yes — Create SOP"
# ─────────────────────────────────────────────
@router.post("/tickets/{issueKey}/create-sop")
async def create_sop(issueKey: str, payload: dict):
    try:
        ticket = await get_ticket(issueKey)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        sop_code         = payload.get("sop_code", "").strip()
        title            = payload.get("title", "").strip()
        keywords         = payload.get("keywords", "").strip()
        symptoms         = payload.get("symptoms", "").strip()
        resolution_steps = payload.get("resolution_steps", "").strip()
        component_code   = payload.get("component_code") or ticket.get("component_code", "")

        if not all([sop_code, title, keywords, symptoms, resolution_steps, component_code]):
            raise HTTPException(status_code=400, detail="All SOP fields are required")

        from services.confluence_service import create_sop_page
        page = await create_sop_page(
            sop_code         = sop_code,
            title            = title,
            keywords         = keywords,
            symptoms         = symptoms,
            resolution_steps = resolution_steps,
            component_code   = component_code,
        )

        if not page:
            raise HTTPException(status_code=500, detail="Failed to create Confluence SOP page")

        from services.embedding_service import get_embedding
        embed_text = f"{sop_code} - {title} {keywords} {symptoms}"
        embedding  = await get_embedding(embed_text)

        if embedding:
            from repositories.sop_repository import upsert_sop_embedding
            await upsert_sop_embedding(sop_code, embedding)

        # ── Mark the SOP reminder ticket as Completed in DB + Jira ──
        from repositories.ticket_repository import supabase
        from services.jira_service import update_jira_status

        supabase.table("tickets") \
            .update({"status": "Completed"}) \
            .eq("issue_key", issueKey) \
            .execute()

        await update_jira_status(issueKey)   # sync to Jira too

        await log_event(
            ticket_id=issueKey,
            event="SOP_CREATED",
            actor="user",
            details=f"New SOP created: {sop_code} - {title}. Reminder ticket auto-completed.",
            metadata={"sop_code": sop_code, "confluence_page_id": page.get("page_id")},
        )

        print(f"✅ [{issueKey}] SOP created, embedded, reminder ticket marked Completed: {sop_code}")
        return {"ok": True, "sop_code": sop_code, "page_id": page.get("page_id")}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ create_sop error: {e}")
        raise HTTPException(status_code=500, detail=str(e))