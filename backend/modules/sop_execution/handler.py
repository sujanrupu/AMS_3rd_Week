# modules/sop_execution/handler.py

from modules.sop_execution.agent import SOPAgent


async def handle_sop_flow(state: dict) -> dict:
    try:
        summary     = state.get("summary", "")

        description = state.get("description", "")
        if not description:
            raw_data = state.get("data")
            if isinstance(raw_data, dict):
                description = raw_data.get("description", "")
            elif hasattr(raw_data, "description"):
                description = raw_data.description or ""

        if not summary:
            return {
                **state,
                "type":    "error",
                "message": "SOP module: ticket summary is empty",
            }

        if not description:
            return {
                **state,
                "type":    "error",
                "message": "SOP module: ticket description is empty",
            }

        agent  = SOPAgent()
        result = await agent.run(
            summary=summary,
            description=description,
            state=state,
        )

        sop_match_type = result.get("sop_match_type", "no_sop_found")

        # Surface no-match as a distinct type so downstream nodes can branch on it
        output_type = (
            "sop_executed"
            if sop_match_type in ("sop_match", "skipped_duplicate")
            else "sop_not_found"
        )

        return {
            **state,
            "sop_title":      result.get("sop_title"),
            "sop_code":       result.get("sop_code"),
            "app_code":       result.get("app_code"),
            "component_code": result.get("component_code"),
            "paired_steps":   result.get("paired_steps", []),
            "sop_match_type":     sop_match_type,
            "type":           output_type,
            "message":        result.get("message", "SOP execution complete"),
        }

    except Exception as e:
        print(f"❌ handle_sop_flow error: {e}")
        return {
            **state,
            "type":    "error",
            "message": f"SOP module failed: {str(e)}",
        }