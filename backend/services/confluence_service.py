# services/confluence_service.py

import requests
from bs4 import BeautifulSoup
from core.config import Config

BASE_URL  = f"https://{Config.JIRA_DOMAIN}/wiki/rest/api"
AUTH      = (Config.JIRA_EMAIL, Config.JIRA_API_TOKEN)
SPACE_KEY = Config.CONFLUENCE_SPACE_KEY


# ─────────────────────────────────────────────
# INTERNAL — fetch page children
# ─────────────────────────────────────────────
def _get_children(page_id: str) -> list:
    try:
        res = requests.get(
            f"{BASE_URL}/content/{page_id}/child/page",
            auth=AUTH,
            params={"limit": 50, "expand": "body.storage,ancestors"},
        )
        return res.json().get("results", [])
    except Exception as e:
        print(f"❌ _get_children error: {e}")
        return []


# ─────────────────────────────────────────────
# INTERNAL — search pages by code prefix
# ─────────────────────────────────────────────
def _search_page_by_code(code: str) -> dict | None:
    try:
        # Try multiple CQL strategies to handle Confluence indexing quirks
        cql_queries = [
            f'space="{SPACE_KEY}" AND title~"{code}" AND type=page',
            f'space="{SPACE_KEY}" AND title="{code}" AND type=page',
            f'type=page AND title~"{code}"',  # fallback: no space filter
        ]

        for cql in cql_queries:
            res = requests.get(
                f"{BASE_URL}/content/search",
                auth=AUTH,
                params={
                    "cql":    cql,
                    "limit":  25,
                    "expand": "body.storage,ancestors",
                }
            )
            results = res.json().get("results", [])
            print(f"🔍 CQL: {cql}")
            print(f"   → Results: {[p['title'] for p in results]}")

            # Strict prefix match: "CMP008 -" or "CMP008-" or exact "CMP008"
            match = next(
                (
                    p for p in results
                    if p["title"].startswith(code)
                    and (
                        len(p["title"]) == len(code)            # exact
                        or p["title"][len(code)] in (" ", "-")  # "CMP008 -" or "CMP008-"
                    )
                ),
                None,
            )
            if match:
                print(f"✅ Matched page: {match['title']}")
                return match

        print(f"⚠️  No page found for code: {code}")
        return None

    except Exception as e:
        print(f"❌ _search_page_by_code error: {e}")
        return None


# ─────────────────────────────────────────────
# INTERNAL — parse SOP page into clean dict
# ─────────────────────────────────────────────
def _parse_sop_page(
    page:           dict,
    app_code:       str,
    app_name:       str,
    component_code: str,
    component_name: str,
) -> dict | None:
    try:
        raw_title = page.get("title", "")
        html      = page.get("body", {}).get("storage", {}).get("value", "")

        sop_code, sop_title = (
            (raw_title.split("-", 1)[0].strip(), raw_title.split("-", 1)[1].strip())
            if "-" in raw_title else (raw_title.strip(), raw_title.strip())
        )

        soup             = BeautifulSoup(html, "html.parser")
        resolution_steps = soup.get_text("\n").strip()

        return {
            "sop_code":         sop_code,
            "title":            sop_title,
            "resolution_steps": resolution_steps,
            "app_code":         app_code,
            "app_name":         app_name,
            "component_code":   component_code,
            "component_name":   component_name,
        }

    except Exception as e:
        print(f"❌ _parse_sop_page error: {e}")
        return None


# ─────────────────────────────────────────────
# FETCH SOP BY app_code + component_code
# ─────────────────────────────────────────────
async def fetch_sop_from_confluence(app_code: str, component_code: str) -> dict | None:
    try:
        print(f"🌐 Confluence fetch — app: {app_code} | component: {component_code}")

        app_page = _search_page_by_code(app_code)
        if not app_page:
            print(f"⚠️  App page not found in Confluence for: {app_code}")
            return None

        app_title = app_page["title"]
        app_name  = app_title.split("-", 1)[1].strip() if "-" in app_title else app_title
        print(f"📁 Found app page: {app_title}")

        comp_pages = _get_children(app_page["id"])
        comp_page  = next(
            (p for p in comp_pages if p["title"].startswith(component_code)),
            None
        )
        if not comp_page:
            print(f"⚠️  Component page not found in Confluence for: {component_code}")
            return None

        comp_title = comp_page["title"]
        comp_name  = comp_title.split("-", 1)[1].strip() if "-" in comp_title else comp_title
        print(f"📁 Found component page: {comp_title}")

        sop_pages = _get_children(comp_page["id"])
        sop_page  = next(
            (p for p in sop_pages if p["title"].startswith("SOP")),
            None
        )
        if not sop_page:
            print(f"⚠️  No SOP page found under component: {component_code}")
            return None

        print(f"📄 Found SOP page: {sop_page['title']}")
        return _parse_sop_page(sop_page, app_code, app_name, component_code, comp_name)

    except Exception as e:
        print(f"❌ fetch_sop_from_confluence error: {e}")
        return None


# ─────────────────────────────────────────────
# FETCH SOP BY sop_code
# ─────────────────────────────────────────────
async def fetch_sop_by_code(sop_code: str) -> dict | None:
    try:
        print(f"🌐 Confluence fetch by sop_code: {sop_code}")

        sop_page = _search_page_by_code(sop_code)
        if not sop_page:
            print(f"⚠️  SOP page not found in Confluence for: {sop_code}")
            return None

        ancestors     = sop_page.get("ancestors", [])
        comp_ancestor = ancestors[-1] if ancestors else None
        app_ancestor  = ancestors[-2] if len(ancestors) >= 2 else None

        comp_title = comp_ancestor["title"] if comp_ancestor else ""
        app_title  = app_ancestor["title"]  if app_ancestor  else ""

        comp_code  = comp_title.split("-", 1)[0].strip() if comp_title else ""
        comp_name  = comp_title.split("-", 1)[1].strip() if "-" in comp_title else comp_title
        app_code   = app_title.split("-", 1)[0].strip()  if app_title  else ""
        app_name   = app_title.split("-", 1)[1].strip()  if "-" in app_title  else app_title

        print(f"📄 Found SOP: {sop_page['title']} under {app_code} / {comp_code}")
        return _parse_sop_page(sop_page, app_code, app_name, comp_code, comp_name)

    except Exception as e:
        print(f"❌ fetch_sop_by_code error: {e}")
        return None


# ─────────────────────────────────────────────
# CREATE SOP PAGE IN CONFLUENCE
# Called when agent manually creates a new SOP
# ─────────────────────────────────────────────
async def create_sop_page(
    sop_code:       str,
    title:          str,
    keywords:       str,
    symptoms:       str,
    resolution_steps: str,
    component_code: str,
) -> dict | None:
    try:
        print(f"📝 Creating Confluence SOP page: {sop_code}")

        # find parent component page
        comp_page = _search_page_by_code(component_code)
        if not comp_page:
            print(f"⚠️  Component page not found: {component_code}")
            return None

        parent_id  = comp_page["id"]
        page_title = f"{sop_code} - {title}"

        # build Confluence storage format HTML
        html_body = f"""<p><strong>Keywords</strong></p>
<p>{keywords}</p>
<p><strong>Symptoms</strong></p>
<ul>
{"".join(f"<li><p>{s.strip()}</p></li>" for s in symptoms.split("\n") if s.strip())}
</ul>
<p><strong>Resolution Steps</strong></p>
<ol>
{"".join(f"<li><p>{s.strip()}</p></li>" for s in resolution_steps.split("\n") if s.strip())}
</ol>"""

        payload = {
            "type":  "page",
            "title": page_title,
            "space": {"key": SPACE_KEY},
            "ancestors": [{"id": parent_id}],
            "body": {
                "storage": {
                    "value":          html_body,
                    "representation": "storage",
                }
            },
        }

        res = requests.post(
            f"{BASE_URL}/content",
            auth=AUTH,
            json=payload,
            headers={"Content-Type": "application/json"},
        )

        if res.status_code not in [200, 201]:
            print(f"❌ Confluence create SOP failed: {res.text}")
            return None

        page = res.json()
        print(f"✅ Confluence SOP page created: {page_title} (id: {page['id']})")
        return {
            "page_id":   page["id"],
            "title":     page_title,
            "sop_code":  sop_code,
        }

    except Exception as e:
        print(f"❌ create_sop_page error: {e}")
        return None