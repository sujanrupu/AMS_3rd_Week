# services/merge_service.py

from repositories.ticket_repository import (
    get_all_tickets,
    get_children,
    supabase
)

from services.jira_service import (
    complete_parent_and_children,
    unlink_duplicate_comments,
    link_duplicate_comments,
    unlink_jira_issues,
    link_jira_issues
)


# ─────────────────────────────────────────────
# MARK DUPLICATE
# ─────────────────────────────────────────────
async def mark_duplicate(issue_key: str):

    try:

        supabase.table("tickets").update({
            "is_duplicate": True
        }).eq("issue_key", issue_key).execute()

        return True

    except Exception as e:

        print(
            "❌ mark_duplicate error:",
            str(e)
        )

        return False


# ─────────────────────────────────────────────
# GET NEXT CHILD NUMBER
# Example:
# TP-650.1
# TP-650.2
# → returns 3
# ─────────────────────────────────────────────
async def get_next_child_number(parent_key: str):

    try:

        res = (
            supabase.table("tickets")
            .select("child_key")
            .eq("parent_ticket_key", parent_key)
            .not_.is_("child_key", "null")
            .execute()
        )

        rows = res.data or []

        max_num = 0

        for row in rows:

            child_key = row.get("child_key")

            if not child_key:
                continue

            try:

                num = int(
                    child_key.split(".")[-1]
                )

                if num > max_num:
                    max_num = num

            except:
                pass

        return max_num + 1

    except Exception as e:

        print(
            "❌ get_next_child_number error:",
            str(e)
        )

        return 1


# ─────────────────────────────────────────────
# MERGE TICKETS
# ─────────────────────────────────────────────
# ─────────────────────────────────────────────
# MERGE TICKETS
# ─────────────────────────────────────────────
async def merge_tickets(
    target_parent: str,
    source_parents: list
):

    try:

        tickets = await get_all_tickets()

        if not tickets:

            return {
                "success": False,
                "message": "No tickets found"
            }

        # remove duplicate sources
        source_parents = list(
            set(source_parents)
        )

        # prevent self merge
        source_parents = [

            s for s in source_parents
            if s != target_parent
        ]

        # ─────────────────────────────
        # FIND TARGET
        # ─────────────────────────────
        target_ticket = next(
            (
                t for t in tickets
                if t["issue_key"] == target_parent
            ),
            None
        )

        if not target_ticket:

            return {
                "success": False,
                "message": "Target not found"
            }

        # target must be parent
        if target_ticket.get(
            "parent_ticket_key"
        ):

            return {
                "success": False,
                "message":
                    "Target ticket must be parent"
            }

        force_completed = (
            target_ticket.get("status")
            == "Completed"
        )

        moved = 0

        # get next child once only
        next_num = await get_next_child_number(
            target_parent
        )

        # ─────────────────────────────
        # PROCESS SOURCE PARENTS
        # ─────────────────────────────
        for source in source_parents:

            source_ticket = next(
                (
                    t for t in tickets
                    if t["issue_key"] == source
                ),
                None
            )

            if not source_ticket:
                continue

            # source must be parent only
            if source_ticket.get(
                "parent_ticket_key"
            ):

                print(
                    f"⚠️ Child merge blocked: {source}"
                )

                continue


            # already merged into target
            if (
                source_ticket.get(
                    "parent_ticket_key"
                ) == target_parent
            ):

                continue


            # source parent
            # + all source children
            source_children = [

                t for t in tickets

                if (

                    t["issue_key"] == source

                    or

                    t.get(
                        "parent_ticket_key"
                    ) == source
                )
            ]


            # ─────────────────────────
            # MOVE EVERYTHING
            # ─────────────────────────
            for t in source_children:

                issue_key = t["issue_key"]

                if issue_key == target_parent:
                    continue


                # already moved
                if (
                    t.get(
                        "parent_ticket_key"
                    ) == target_parent
                ):
                    continue


                # remove previous Jira links
                if issue_key != source:

                    await unlink_duplicate_comments(
                        source,
                        issue_key
                    )

                    await unlink_jira_issues(
                        source,
                        issue_key
                    )


                update_payload = {

                    "parent_ticket_key":
                        target_parent,

                    "child_key":
                        f"{target_parent}.{next_num}",

                    "is_duplicate": True
                }

                next_num += 1


                if force_completed:

                    update_payload[
                        "status"
                    ] = "Completed"


                # DB update
                supabase.table(
                    "tickets"
                ).update(
                    update_payload
                ).eq(
                    "issue_key",
                    issue_key
                ).execute()


                # new Jira links
                await link_duplicate_comments(
                    target_parent,
                    issue_key
                )

                await link_jira_issues(
                    target_parent,
                    issue_key
                )


                moved += 1


                print(
                    f"✅ Merged "
                    f"{issue_key}"
                    f" -> "
                    f"{target_parent}"
                )


        # ─────────────────────────────
        # COMPLETED SYNC
        # ─────────────────────────────
        if force_completed:

            jira_result = (
                await complete_parent_and_children(
                    target_parent
                )
            )

            print(
                "🔥 Jira sync:",
                jira_result
            )


        return {

            "success": True,

            "target": target_parent,

            "sources": source_parents,

            "moved": moved,

            "status_sync":
                force_completed,

            "jira_synced":
                force_completed
        }


    except Exception as e:

        print(
            "❌ merge_tickets error:",
            str(e)
        )

        return {

            "success": False,

            "message": str(e)
        }

