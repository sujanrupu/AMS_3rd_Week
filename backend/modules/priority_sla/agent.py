import json
import re

from groq import Groq
from core.config import Config
from .prompt import IMPACT_ASSESSMENT_SYSTEM_PROMPT, URGENCY_ASSESSMENT_SYSTEM_PROMPT


client = Groq(api_key=Config.GROQ_API_KEY)


# ────────────────────────────────────────────
# IMPACT AGENT
# ────────────────────────────────────────────

async def run_impact_agent(
    summary: str,
    description: str,
    user_impact: str,
    kb_context: str,
) -> dict:
    """
    Calls the LLM to revalidate impact.

    Returns:
        {
          "revalidated_impact": str,
          "confidence": int,
          "rationale": str
        }
    """
    user_message = _build_impact_user_message(
        summary=summary,
        description=description,
        user_impact=user_impact,
        kb_context=kb_context,
    )

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": IMPACT_ASSESSMENT_SYSTEM_PROMPT},
                {"role": "user",   "content": user_message},
            ],
            temperature=0.1,
        )

        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"^```(?:json)?", "", raw).strip()
        raw = re.sub(r"```$", "", raw).strip()

        result = json.loads(raw)

        if not all(k in result for k in ("revalidated_impact", "confidence", "rationale")):
            raise ValueError("Impact agent: missing required keys in LLM response")

        valid_impacts = ["Extensive", "Significant", "Moderate", "Minor"]
        if result["revalidated_impact"] not in valid_impacts:
            raise ValueError(f"Impact agent: invalid value '{result['revalidated_impact']}'")

        result["confidence"] = max(0, min(100, int(result["confidence"])))
        result["rationale"]  = str(result["rationale"]).strip()

        return result

    except (json.JSONDecodeError, ValueError, KeyError) as e:
        print(f"[ImpactAgent] ⚠️  LLM parse error: {e}")
        # Fallback: accept user's value, confidence 0
        return {
            "revalidated_impact": user_impact,
            "confidence":         0,
            "rationale":          "AI could not assess impact with sufficient confidence. Using user-provided value.",
        }


# ────────────────────────────────────────────
# URGENCY AGENT
# ────────────────────────────────────────────

async def run_urgency_agent(
    summary: str,
    description: str,
    user_urgency: str,
    kb_context: str,
) -> dict:
    """
    Calls the LLM to revalidate urgency.

    Returns:
        {
          "revalidated_urgency": str,
          "confidence": int,
          "rationale": str
        }
    """
    user_message = _build_urgency_user_message(
        summary=summary,
        description=description,
        user_urgency=user_urgency,
        kb_context=kb_context,
    )

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": URGENCY_ASSESSMENT_SYSTEM_PROMPT},
                {"role": "user",   "content": user_message},
            ],
            temperature=0.1,
        )

        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"^```(?:json)?", "", raw).strip()
        raw = re.sub(r"```$", "", raw).strip()

        result = json.loads(raw)

        if not all(k in result for k in ("revalidated_urgency", "confidence", "rationale")):
            raise ValueError("Urgency agent: missing required keys in LLM response")

        valid_urgencies = ["Critical", "High", "Medium", "Low"]
        if result["revalidated_urgency"] not in valid_urgencies:
            raise ValueError(f"Urgency agent: invalid value '{result['revalidated_urgency']}'")

        result["confidence"] = max(0, min(100, int(result["confidence"])))
        result["rationale"]  = str(result["rationale"]).strip()

        return result

    except (json.JSONDecodeError, ValueError, KeyError) as e:
        print(f"[UrgencyAgent] ⚠️  LLM parse error: {e}")
        return {
            "revalidated_urgency": user_urgency,
            "confidence":          0,
            "rationale":           "AI could not assess urgency with sufficient confidence. Using user-provided value.",
        }


# ────────────────────────────────────────────
# MESSAGE BUILDERS
# ────────────────────────────────────────────

def _build_impact_user_message(
    summary: str,
    description: str,
    user_impact: str,
    kb_context: str,
) -> str:
    parts = [
        f"TICKET SUMMARY:\n{summary}",
        f"\nTICKET DESCRIPTION:\n{description}",
        f"\nUSER-PROVIDED IMPACT: {user_impact}",
    ]

    if kb_context:
        parts.append(f"\nKNOWLEDGE BASE MATCHES (similar historical tickets):\n{kb_context}")
    else:
        parts.append("\nNo similar tickets found in knowledge base. Classify based on description alone.")

    parts.append(
        "\nBased on the above, determine the correct impact level. "
        "Respond ONLY with the JSON object."
    )

    return "\n".join(parts)


def _build_urgency_user_message(
    summary: str,
    description: str,
    user_urgency: str,
    kb_context: str,
) -> str:
    parts = [
        f"TICKET SUMMARY:\n{summary}",
        f"\nTICKET DESCRIPTION:\n{description}",
        f"\nUSER-PROVIDED URGENCY: {user_urgency}",
    ]

    if kb_context:
        parts.append(f"\nKNOWLEDGE BASE MATCHES (similar historical tickets):\n{kb_context}")
    else:
        parts.append("\nNo similar tickets found in knowledge base. Classify based on description alone.")

    parts.append(
        "\nBased on the above, determine the correct urgency level. "
        "Respond ONLY with the JSON object."
    )

    return "\n".join(parts)


# ────────────────────────────────────────────
# KB CONTEXT BUILDER (shared)
# ────────────────────────────────────────────

def build_impact_kb_context(matches: list) -> str:
    lines = []
    for i, m in enumerate(matches, start=1):
        sim_pct = round(m.get("similarity", 0) * 100, 1)
        lines.append(
            f"[KB Match {i}] Similarity: {sim_pct}%\n"
            f"  Summary:    {m.get('summary', '')[:150]}\n"
            f"  Impact:     {m.get('revalidated_impact', 'Unknown')}\n"
            f"  Affected:   {m.get('affected_users', 'N/A')} | Area: {m.get('business_area', 'N/A')}"
        )
    return "\n\n".join(lines)


def build_urgency_kb_context(matches: list) -> str:
    lines = []
    for i, m in enumerate(matches, start=1):
        sim_pct = round(m.get("similarity", 0) * 100, 1)
        lines.append(
            f"[KB Match {i}] Similarity: {sim_pct}%\n"
            f"  Summary:     {m.get('summary', '')[:150]}\n"
            f"  Urgency:     {m.get('revalidated_urgency', 'Unknown')}\n"
            f"  Time Sensitivity: {m.get('time_sensitivity', 'N/A')} | Workaround: {m.get('workaround', 'N/A')}"
        )
    return "\n\n".join(lines)