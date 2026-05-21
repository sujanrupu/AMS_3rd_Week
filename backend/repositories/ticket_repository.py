# repositories/ticket_repository.py

from supabase import create_client
from core.config import Config
from services.embedding_service import get_embedding

supabase = create_client(
    Config.SUPABASE_URL,
    Config.SUPABASE_KEY
)

ALLOWED_FIELDS = {

    # ── identifiers ──
    "issue_key", "child_key", "parent_ticket_key",

    # ── user ──
    "name", "email",

    # ── ticket content ──
    "summary", "description",

    # ── app details ──
    "app_name", "component_name", "app_code", "component_code",
    "esc_team", "esc_level", "esc_confidence", "esc_action", "esc_rationale", "escalated_at",

     # ── priority ──
    "urgency", "impact",
    
     # ── priority SLA ──
    "revalidated_impact",
    "revalidated_urgency",
    "priority",
    "sla_response_time",
    "sla_resolution_time",
    "impact_confidence",
    "urgency_confidence",
    "priority_assigned_at",

    # ── HITL ──
    "hitl_reviewed",
    "hitl_approver",
    "hitl_business_justification",
    "hitl_affected_teams",
    "hitl_escalation_path",
    "hitl_comments",
    "hitl_submitted_at",

    # ── status ──
    "status", "is_duplicate",

    # ── AI vector ──
    "embedding",

    # ── sop ──
    "paired_steps",
    "sop_title",
    "sop_code",        # replaces sop_category
    "sop_match_type",

    # ── RCA ──
    "rca_root_cause", "rca_affected",
    "rca_confidence",
    "rca_source"
}


# ─────────────────────────────────────────────
# INSERT TICKET
# ─────────────────────────────────────────────
async def insert_ticket(data):
    print("🔥 FINAL RAW PAYLOAD:", data)

    try:
        data = dict(data)

        data = {
            k: v
            for k, v in data.items()
            if k in ALLOWED_FIELDS
        }

        if data.get("embedding") is not None:
            data["embedding"] = [
                float(x)
                for x in data["embedding"]
            ]

        data.setdefault("child_key", None)
        data.setdefault("parent_ticket_key", None)
        data.setdefault("paired_steps", [])
        data.setdefault("app_name", "General")
        data.setdefault("component_name", "General")

        res = (
            supabase
            .table("tickets")
            .insert(data)
            .execute()
        )

        return res.data[0] if res.data else None

    except Exception as e:
        print("❌ insert_ticket error:", str(e))
        return None


# ─────────────────────────────────────────────
# GET ALL TICKETS
# ─────────────────────────────────────────────
async def get_all_tickets():
    try:
        res = supabase.table("tickets").select("*").execute()
        return res.data or []
    except Exception as e:
        print("❌ get_all_tickets error:", str(e))
        return []


# ─────────────────────────────────────────────
# GET SINGLE TICKET
# ─────────────────────────────────────────────
async def get_ticket(issue_key: str):
    try:
        res = (
            supabase.table("tickets")
            .select("*")
            .eq("issue_key", issue_key)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    except Exception as e:
        print("❌ get_ticket error:", str(e))
        return None


# ─────────────────────────────────────────────
# VECTOR SEARCH — SIMILAR TICKETS
# ─────────────────────────────────────────────
async def search_similar_tickets(
    query_embedding,
    top_k=5,
    app_name="",
    component_name=""
):
    try:
        if not query_embedding:
            return []

        query_embedding = [float(x) for x in query_embedding]

        res = supabase.rpc(
            "match_tickets",
            {
                "query_embedding":  query_embedding,
                "match_count":      top_k,
                "app_filter":       app_name,
                "component_filter": component_name,
            }
        ).execute()

        return res.data or []

    except Exception as e:
        print("❌ vector search error:", str(e))
        return []


async def search_completed_tickets_with_rca(
    query_embedding: list,
    top_k: int = 5
) -> list:
    try:
        if not query_embedding:
            return []
        res = supabase.rpc(
            "match_completed_tickets_with_rca",
            {
                "query_embedding": [float(x) for x in query_embedding],
                "match_count":     top_k,
            }
        ).execute()
        return res.data or []
    except Exception as e:
        print("❌ search_completed_tickets_with_rca error:", str(e))
        return []
    

async def update_ticket_rca(
    issue_key:          str,
    root_cause:         str,
    affected_component: str,
    confidence:         str,
    source:             str,
) -> bool:
    try:
        res = (
            supabase.table("tickets")
            .update({
                "rca_root_cause": root_cause,
                "rca_affected":   affected_component,
                "rca_confidence": confidence,
                "rca_source":     source,
            })
            .eq("issue_key", issue_key)
            .execute()
        )
        if res.data:
            return True
        print(f"⚠️  update_ticket_rca: no rows updated for {issue_key}")
        return False
    except Exception as e:
        print(f"❌ update_ticket_rca error: {e}")
        return False
    

# ─────────────────────────────────────────────
# DELETE SINGLE
# ─────────────────────────────────────────────
async def delete_ticket(issue_key: str):
    try:
        res = (
            supabase.table("tickets")
            .delete()
            .eq("issue_key", issue_key)
            .execute()
        )
        return bool(res.data)

    except Exception as e:
        print("❌ delete_ticket error:", str(e))
        return False


# ─────────────────────────────────────────────
# DELETE CASCADE
# ─────────────────────────────────────────────
async def delete_ticket_cascade(parent_key: str):
    try:
        res = (
            supabase.table("tickets")
            .delete()
            .or_(
                f"issue_key.eq.{parent_key},"
                f"parent_ticket_key.eq.{parent_key}"
            )
            .execute()
        )
        return bool(res.data)

    except Exception as e:
        print("❌ delete_ticket_cascade error:", str(e))
        return False


# ─────────────────────────────────────────────
# UPDATE STATUS CASCADE
# ─────────────────────────────────────────────
async def update_status_cascade(parent_key: str, status: str):
    try:
        res = (
            supabase.table("tickets")
            .update({"status": status})
            .or_(
                f"issue_key.eq.{parent_key.strip()},"
                f"parent_ticket_key.eq.{parent_key.strip()}"
            )
            .execute()
        )
        return bool(res.data)

    except Exception as e:
        print("❌ update_status_cascade error:", str(e))
        return False


# ─────────────────────────────────────────────
# SOP UPDATE
# ─────────────────────────────────────────────
async def update_ticket_sop(
    issue_key:      str,
    paired_steps:   list,
    sop_title:      str | None = None,
    sop_code:       str | None = None,   # replaces sop_category
    app_code:       str | None = None,
    component_code: str | None = None,
    sop_match_type: str | None = None,
) -> bool:
    try:
        res = (
            supabase.table("tickets")
            .update({
                "paired_steps":   paired_steps,
                "sop_title":      sop_title,
                "sop_code":       sop_code,
                "app_code":       app_code,
                "component_code": component_code,
                "sop_match_type": sop_match_type,
            })
            .eq("issue_key", issue_key)
            .execute()
        )
        return bool(res.data)

    except Exception as e:
        print("❌ update_ticket_sop error:", str(e))
        return False


# ─────────────────────────────────────────────
# GET ONLY PARENT TICKETS
# ─────────────────────────────────────────────
async def get_parent_tickets():
    try:
        res = (
            supabase.table("tickets")
            .select("*")
            .is_("parent_ticket_key", None)
            .execute()
        )
        return res.data or []

    except Exception as e:
        print("❌ get_parent_tickets error:", str(e))
        return []


# ─────────────────────────────────────────────
# GET CHILDREN
# ─────────────────────────────────────────────
async def get_children(parent_key: str):
    try:
        res = (
            supabase.table("tickets")
            .select("*")
            .eq("parent_ticket_key", parent_key)
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []

    except Exception as e:
        print("❌ get_children error:", str(e))
        return False


# ─────────────────────────────────────────────
# UPDATE PARENT LINK
# ─────────────────────────────────────────────
async def update_parent(issue_key: str, new_parent: str):
    try:
        res = (
            supabase.table("tickets")
            .update({"parent_ticket_key": new_parent})
            .eq("issue_key", issue_key)
            .execute()
        )
        return bool(res.data)

    except Exception as e:
        print("❌ update_parent error:", str(e))
        return False


# ─────────────────────────────────────────────
# BULK CHILD KEY UPDATE
# ─────────────────────────────────────────────
async def update_child_keys(updates: list):
    try:
        for item in updates:
            supabase.table("tickets") \
                .update({"child_key": item["child_key"]}) \
                .eq("issue_key", item["issue_key"]) \
                .execute()
        return True

    except Exception as e:
        print("❌ update_child_keys error:", str(e))
        return False


# ─────────────────────────────────────────────
# DETACH CHILD TICKET
# ─────────────────────────────────────────────
async def detach_child_ticket(issue_key: str):
    try:
        res = (
            supabase.table("tickets")
            .select("*")
            .eq("issue_key", issue_key)
            .single()
            .execute()
        )

        ticket = res.data
        if not ticket:
            return False

        embedding = ticket.get("embedding")
        if not embedding:
            print("⚡ embedding missing → generating now")
            text = f"{ticket.get('summary', '')} {ticket.get('description', '')}".strip()
            new_embedding = await get_embedding(text)
            if new_embedding:
                supabase.table("tickets").update({
                    "embedding": new_embedding
                }).eq("issue_key", issue_key).execute()
                print("✅ embedding stored for detached ticket")

        res = (
            supabase.table("tickets")
            .update({
                "child_key":         None,
                "parent_ticket_key": None,
                "is_duplicate":      False,
            })
            .eq("issue_key", issue_key)
            .execute()
        )
        return bool(res.data)

    except Exception as e:
        print("❌ detach_child_ticket error:", str(e))
        return False


# ─────────────────────────────────────────────
# DELETE ONLY SINGLE TICKET
# ─────────────────────────────────────────────
async def delete_single_ticket(issue_key: str):
    try:
        res = (
            supabase.table("tickets")
            .delete()
            .eq("issue_key", issue_key)
            .execute()
        )
        return bool(res.data)

    except Exception as e:
        print("❌ delete_single_ticket error:", str(e))
        return False


# ─────────────────────────────────────────────
# PROMOTE FIRST CHILD AS NEW PARENT
# ─────────────────────────────────────────────
async def promote_first_child_as_parent(old_parent_key: str):
    try:
        children = (
            supabase.table("tickets")
            .select("*")
            .eq("parent_ticket_key", old_parent_key)
            .order("issue_key", desc=False)
            .execute()
        )
        children = children.data or []

        if not children:
            return None

        new_parent     = children[0]
        new_parent_key = new_parent["issue_key"]

        supabase.table("tickets") \
            .update({
                "parent_ticket_key": None,
                "child_key":         None,
                "is_duplicate":      False,
            }) \
            .eq("issue_key", new_parent_key) \
            .execute()

        remaining = sorted(children[1:], key=lambda x: x["issue_key"])
        counter   = 1

        for child in remaining:
            supabase.table("tickets") \
                .update({
                    "parent_ticket_key": new_parent_key,
                    "child_key":         f"{new_parent_key}.{counter}",
                }) \
                .eq("issue_key", child["issue_key"]) \
                .execute()
            counter += 1

        return new_parent_key

    except Exception as e:
        print("❌ promote_first_child_as_parent error:", str(e))
        return None


# ─────────────────────────────────────────────
# SEARCH COMPLETED TICKETS
# ─────────────────────────────────────────────
async def search_completed_tickets(
    query_embedding,
    top_k=5,
    app_name="",
    component_name=""
):
    try:
        if not query_embedding:
            print("❌ Empty embedding received")
            return []

        query_embedding = [float(x) for x in query_embedding]

        def clean(value):
            if not value:
                return None
            value = value.strip()
            return value or None

        app_name       = clean(app_name)
        component_name = clean(component_name)

        print("\n📤 RPC INPUT DEBUG")
        print("app_name:", repr(app_name))
        print("component_name:", repr(component_name))
        print("embedding_size:", len(query_embedding))

        if len(query_embedding) != 384:
            print("❌ Invalid embedding size:", len(query_embedding))
            return []

        res = supabase.rpc(
            "search_completed_tickets",
            {
                "query_embedding":  query_embedding,
                "match_count":      top_k,
                "app_filter":       app_name,
                "component_filter": component_name,
            }
        ).execute()

        data = res.data or []

        print("\n========= COMPLETED SEARCH (RAW DB OUTPUT) =========")
        for d in data:
            print({
                "issue_key":      d.get("issue_key"),
                "app_name":       d.get("app_name"),
                "component_name": d.get("component_name"),
                "similarity":     d.get("similarity"),
            })
        print("====================================================\n")

        return data

    except Exception as e:
        print("❌ completed ticket search error:", str(e))
        return []


# ─────────────────────────────────────────────
# UPDATE TICKET ESCALATION
# ─────────────────────────────────────────────
async def update_ticket_escalation(
    issue_key:          str,
    escalated_to:       str,
    escalation_channel: str,
    escalated_at:       str,
) -> bool:
    try:
        res = (
            supabase.table("tickets")
            .update({
                "escalated_to":       escalated_to,
                "escalation_channel": escalation_channel,
                "escalated_at":       escalated_at,
            })
            .eq("issue_key", issue_key)
            .execute()
        )
        print("🔥 SUPABASE RESPONSE:", res.data)
        return bool(res.data)
    except Exception as e:
        print("❌ update_ticket_escalation error:", str(e))
        return False


# ─────────────────────────────────────────────
# UPDATE ONLY CHILDREN STATUS
# ─────────────────────────────────────────────
async def update_children_status(parent_key: str, status: str):
    try:
        res = (
            supabase.table("tickets")
            .update({"status": status})
            .eq("parent_ticket_key", parent_key.strip())
            .execute()
        )
        return bool(res.data)

    except Exception as e:
        print("❌ update_children_status error:", str(e))
        return False

# ─────────────────────────────────────────────
# SMART ESCALATION UPDATE (v2) — esc_ columns
# ─────────────────────────────────────────────
async def update_ticket_escalation_v2(
    issue_key:      str,
    esc_team:       str,
    esc_level:      str,
    esc_confidence: str,
    esc_action:     str,
    esc_rationale:  str,
    escalated_at:   str,
) -> bool:
    try:
        res = (
            supabase.table("tickets")
            .update({
                "esc_team":       esc_team,
                "esc_level":      esc_level,
                "esc_confidence": esc_confidence,
                "esc_action":     esc_action,
                "esc_rationale":  esc_rationale,
                "escalated_at":   escalated_at,
            })
            .eq("issue_key", issue_key)
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        print("❌ update_ticket_escalation_v2 error:", str(e))
        return False




# ─────────────────────────────────────────────
# INSERT SOP REMINDER TICKET
# Creates a brand-new ticket row for the P4 Jira reminder.
# sop_parent_key links it back to the original ticket.
# ─────────────────────────────────────────────
async def insert_sop_reminder_ticket(
    jira_key:       str,
    sop_parent_key: str,
    app_name:       str,
    component_name: str,
    app_code:       str | None = None,
    component_code: str | None = None,
) -> dict | None:
    try:
        row = {
            "issue_key":          jira_key,
            "sop_parent_key":     sop_parent_key,
            "summary":            f"No SOP Found - {app_name} - {component_name}",
            "description":        f"No SOP was found for {app_name} / {component_name}. Please create one.",
            "status":             "Open",
            "app_name":           app_name,
            "component_name":     component_name,
            "app_code":           app_code,
            "component_code":     component_code,
            "urgency":            "Low",
            "impact":             "Minor",
            "child_key":          None,
            "parent_ticket_key":  None,
            "paired_steps":       [],
        }

        res = (
            supabase
            .table("tickets")
            .insert(row)
            .execute()
        )

        inserted = res.data[0] if res.data else None
        print(f"✅ SOP reminder ticket inserted: {jira_key} → sop_parent_key={sop_parent_key}")
        return inserted

    except Exception as e:
        print(f"❌ insert_sop_reminder_ticket error: {e}")
        return None