# repositories/sop_repository.py

import asyncio
from supabase import create_client
from core.config import Config

supabase = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)


async def search_sops_by_vector(embedding: list[float], top_k: int = 1) -> list[dict]:
    try:
        if not embedding:
            return []

        embedding = [float(x) for x in embedding]

        def _query():
            return supabase.rpc(
                "match_sops",
                {
                    "query_embedding": embedding,
                    "match_count":     top_k,
                }
            ).execute()

        res = await asyncio.get_event_loop().run_in_executor(None, _query)

        if res.data:
            return res.data

        print("⚠️  No matches found from vector search")
        return []

    except Exception as e:
        print(f"❌ search_sops_by_vector error: {e}")
        return []


# ─────────────────────────────────────────────
# UPSERT SOP EMBEDDING
# Called after new SOP is created manually
# ─────────────────────────────────────────────
async def upsert_sop_embedding(
    sop_code:  str,
    embedding: list[float],
) -> bool:
    try:
        def _query():
            return supabase.table("sops").upsert(
                {"sop_code": sop_code, "embedding": embedding},
                on_conflict="sop_code",
            ).execute()

        res = await asyncio.get_event_loop().run_in_executor(None, _query)
        print(f"✅ SOP embedding upserted: {sop_code}")
        return bool(res.data)

    except Exception as e:
        print(f"❌ upsert_sop_embedding error: {e}")
        return False