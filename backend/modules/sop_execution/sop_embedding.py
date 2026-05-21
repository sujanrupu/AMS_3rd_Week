import os
import requests
from dotenv import load_dotenv
from supabase import create_client
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer

load_dotenv()

SUPABASE_URL   = os.getenv("SUPABASE_URL")
SUPABASE_KEY   = os.getenv("SUPABASE_KEY")
JIRA_EMAIL     = os.getenv("JIRA_EMAIL")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")
JIRA_DOMAIN    = os.getenv("JIRA_DOMAIN")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
model    = SentenceTransformer("all-MiniLM-L6-v2")


def fetch_pages():
    res = requests.get(
        f"https://{JIRA_DOMAIN}/wiki/rest/api/content",
        auth=(JIRA_EMAIL, JIRA_API_TOKEN),
        params={"type": "page", "limit": 200, "expand": "body.storage"},
    )
    res.raise_for_status()
    return res.json().get("results", [])


def extract_section(soup: BeautifulSoup, heading: str) -> str:
    """Extract text under a <strong> heading in Confluence storage format."""
    for tag in soup.find_all("p"):
        strong = tag.find("strong")
        if strong and heading.lower() in strong.get_text().lower():
            parts = []
            for sibling in tag.find_next_siblings():
                # stop at next section heading
                if sibling.find("strong"):
                    break
                parts.append(sibling.get_text(" ").strip())
            return " ".join(parts).strip()
    return ""


pages = fetch_pages()
sops  = [p for p in pages if p.get("title", "").startswith("SOP")]
print(f"✅ SOPs found: {len(sops)}")

ok = err = 0

for s in sops:
    raw_title = s.get("title", "")
    try:
        html  = s.get("body", {}).get("storage", {}).get("value", "")
        soup  = BeautifulSoup(html, "html.parser")

        keywords = extract_section(soup, "keyword")
        symptoms = extract_section(soup, "symptom")

        sop_code = raw_title.split("-", 1)[0].strip() if "-" in raw_title else raw_title.strip()

        # ✅ title + keywords + symptoms — rich semantic signal, no HTML noise
        embed_text = " ".join(filter(None, [raw_title, keywords, symptoms]))
        embedding  = model.encode(embed_text).tolist()
        assert len(embedding) == 384, f"unexpected dims: {len(embedding)}"

        supabase.table("sops").upsert(
            {"sop_code": sop_code, "embedding": embedding},
            on_conflict="sop_code",
        ).execute()

        print(f"✅ {sop_code} — embed_text: '{embed_text[:80]}...'")
        ok += 1

    except Exception as e:
        print(f"❌ {raw_title} → {e}")
        err += 1

print(f"\n🎉 Done — {ok} inserted, {err} failed")