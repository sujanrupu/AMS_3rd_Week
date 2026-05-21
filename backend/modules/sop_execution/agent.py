# modules/sop_execution/agent.py

from services.llm_service import call_llm
from modules.sop_execution.service import (
    fetch_best_sop,
    parse_llm_output,
    filter_safe_commands,
)
from modules.sop_execution.prompt import SOP_CHECKLIST_PROMPT
from services.confluence_service import (
    fetch_sop_from_confluence,
    fetch_sop_by_code,
)


class SOPAgent:

    async def run(self, summary: str, description: str, state: dict) -> dict:

        is_duplicate  = state.get("is_duplicate", False)
        parent_ticket = state.get("parent_ticket_key") or state.get("parent_key")

        if is_duplicate and parent_ticket:
            print(f"[SOPAgent] ⏭️  Skipping — duplicate of {parent_ticket}")
            return {
                "sop_title":      None,
                "sop_code":       None,
                "paired_steps":   [],
                "sop_match_type": "skipped_duplicate",
                "message":        f"SOP skipped — duplicate of parent ticket {parent_ticket}",
            }

        # ── Resolve app/component from state or nested data ──
        data           = state.get("data") or {}
        app_code       = state.get("app_code")       or (data.get("app_code")       if isinstance(data, dict) else None)
        component_code = state.get("component_code") or (data.get("component_code") if isinstance(data, dict) else None)

        # ── Fast path: app + component known → fetch directly from Confluence ──
        if app_code and component_code:
            print(f"⚡ [{summary[:40]}] Direct Confluence fetch — app: {app_code} | component: {component_code}")
            sop = await fetch_sop_from_confluence(app_code, component_code)
            if sop:
                print(f"✅ [{summary[:40]}] SOP fetched from Confluence — [{sop.get('sop_code')}] {sop.get('title')}")
                return await self._generate_with_sop(summary, description, sop)

            # ✅ app+component provided but not found in Confluence — abort, no vector search
            print(f"❌ [{summary[:40]}] App/component not found in Confluence — aborting")
            return {
                "sop_title":      None,
                "sop_code":       None,
                "paired_steps":   [],
                "sop_match_type": "no_sop_found",
                "message":        "App/component not recognized in knowledge base. Please escalate for manual triage.",
            }

        # ── Slow path: no app/component on ticket → vector search only ──
        print(f"🔍 [{summary[:40]}] No app/component on ticket — running vector search")
        match = await fetch_best_sop(summary, description)

        if match:
            sop_code = match.get("sop_code")
            print(f"🔎 [{summary[:40]}] Vector matched sop_code: {sop_code} — fetching from Confluence")
            sop = await fetch_sop_by_code(sop_code)
            if sop:
                print(f"✅ [{summary[:40]}] SOP fetched from Confluence — [{sop.get('sop_code')}] {sop.get('title')}")
                return await self._generate_with_sop(summary, description, sop)
            print(f"⚠️  [{summary[:40]}] Confluence fetch by code failed for: {sop_code}")

        print(f"❌ [{summary[:40]}] No SOP matched — halting. Manual review required.")
        return {
            "sop_title":      None,
            "sop_code":       None,
            "paired_steps":   [],
            "sop_match_type": "no_sop_found",
            "message":        (
                "No matching SOP found in the knowledge base. "
                "Please escalate for manual triage."
            ),
        }

    async def _generate_with_sop(
        self, summary: str, description: str, sop: dict
    ) -> dict:

        prompt = SOP_CHECKLIST_PROMPT.format(
            summary        = summary,
            description    = description or "N/A",
            sop_code       = sop.get("sop_code", ""),
            sop_title      = sop.get("title", ""),
            app_code       = sop.get("app_code", ""),
            app_name       = sop.get("app_name", ""),
            component_code = sop.get("component_code", ""),
            component_name = sop.get("component_name", ""),
            sop_keywords   = sop.get("keywords", "") or "N/A",
            sop_symptoms   = sop.get("symptoms", "") or "N/A",
            sop_steps      = sop.get("resolution_steps", ""),
        )

        raw    = await call_llm(prompt)
        paired = parse_llm_output(raw)
        paired = filter_safe_commands(paired)

        return {
            "sop_title":      sop.get("title"),
            "sop_code":       sop.get("sop_code"),
            "app_code":       sop.get("app_code"),
            "component_code": sop.get("component_code"),
            "paired_steps":   paired,
            "sop_match_type": "sop_match",
            "message":        f"SOP matched: [{sop.get('sop_code')}] {sop.get('title')}",
        }