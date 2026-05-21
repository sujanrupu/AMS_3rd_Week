import asyncio

from core.config import supabase
from services.embedding_service import get_embedding


async def embed_escalation_kb() -> None:

    print("[KB Embedding] Fetching rows with no embedding...")

    response = (
        supabase
        .table("escalation_kb")
        .select("id, example_description")
        .is_("embedding", "null")
        .execute()
    )

    rows = response.data or []

    if not rows:
        print("[KB Embedding] ✅ All rows already have embeddings. Nothing to do.")
        return

    print(f"[KB Embedding] Found {len(rows)} rows to embed.")

    success = 0
    failed  = 0

    for row in rows:
        row_id      = row["id"]
        description = row["example_description"]

        try:
            embedding = await get_embedding(description)

            if not embedding:
                print(f"[KB Embedding] ⚠️  Row {row_id}: embedding returned None. Skipping.")
                failed += 1
                continue

            embedding = [float(x) for x in embedding]

            supabase.table("escalation_kb").update(
                {"embedding": embedding}
            ).eq("id", row_id).execute()

            print(f"[KB Embedding] ✅ Row {row_id} embedded.")
            success += 1

        except Exception as e:
            print(f"[KB Embedding] ❌ Row {row_id} failed: {e}")
            failed += 1

    print(f"\n[KB Embedding] Done. Success: {success} | Failed: {failed}")
    print(
        "\n[KB Embedding] ✅ KB is ready. "
        "The AI can now search the escalation document via vector similarity."
    )


if __name__ == "__main__":
    asyncio.run(embed_escalation_kb())
