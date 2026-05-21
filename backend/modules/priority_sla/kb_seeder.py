# modules/priority_sla/kb_seeder.py
# ─────────────────────────────────────────────────────────────────────────────
# One-time script: generates embeddings for all KB seed rows that have
# embedding = NULL, then upserts them back to Supabase.
#
# Run once after applying priority_sla_kb.sql:
#   python -m modules.priority_sla.kb_seeder
#
# Safe to re-run — only processes rows where embedding IS NULL.
# ─────────────────────────────────────────────────────────────────────────────

import asyncio
from sentence_transformers import SentenceTransformer
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
model    = SentenceTransformer("all-MiniLM-L6-v2")


def make_text(row: dict) -> str:
    """Combine summary + description for embedding."""
    parts = [row.get("summary", ""), row.get("description", "")]
    return "\n".join(p for p in parts if p).strip()


def embed_rows(rows: list) -> list:
    texts      = [make_text(r) for r in rows]
    embeddings = model.encode(texts)
    return [emb.tolist() for emb in embeddings]


def seed_table(table_name: str) -> None:
    print(f"\n  Seeding {table_name}...")

    # Fetch all rows that still need embeddings
    res = (
        supabase
        .table(table_name)
        .select("id, summary, description")
        .is_("embedding", "null")
        .execute()
    )

    rows = res.data or []

    if not rows:
        print(f"   ✅ All rows in {table_name} already have embeddings.")
        return

    print(f"   Found {len(rows)} rows without embeddings. Embedding now...")

    embeddings = embed_rows(rows)

    success = 0
    for row, emb in zip(rows, embeddings):
        try:
            supabase.table(table_name).update(
                {"embedding": emb}
            ).eq("id", row["id"]).execute()
            success += 1
        except Exception as e:
            print(f"   ❌  Failed to update row {row['id']}: {e}")

    print(f"   ✅  {success}/{len(rows)} rows embedded successfully.")


if __name__ == "__main__":
    seed_table("impact_assessment_kb")
    seed_table("urgency_assessment_kb")
    print("\n🎉  KB seeding complete.\n")
