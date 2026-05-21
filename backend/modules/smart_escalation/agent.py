import json
import re

from groq import Groq

from core.config import Config
from .prompt import ESCALATION_SYSTEM_PROMPT


client = Groq(api_key=Config.GROQ_API_KEY)


async def run_escalation_agent(
    summary: str,
    description: str,
    kb_context: str,
    learned_signal: str,
) -> dict:

    user_message = _build_user_message(
        summary=summary,
        description=description,
        kb_context=kb_context,
        learned_signal=learned_signal,
    )

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": ESCALATION_SYSTEM_PROMPT},
                {"role": "user",   "content": user_message},
            ],
            temperature=0.1,
        )

        raw = response.choices[0].message.content.strip()

        raw = re.sub(r"^```(?:json)?", "", raw).strip()
        raw = re.sub(r"```$",          "", raw).strip()

        result = json.loads(raw)

        if not all(k in result for k in ("team", "level", "confidence", "rationale")):
            raise ValueError("LLM response missing required keys")

        result["team"]       = str(result["team"]).strip()
        result["level"]      = str(result["level"]).upper().strip()
        result["confidence"] = int(result["confidence"])
        result["rationale"]  = str(result["rationale"]).strip()

        if result["level"] not in ("L1", "L2", "L3"):
            raise ValueError(f"Invalid level returned: {result['level']}")

        result["confidence"] = max(0, min(100, result["confidence"]))

        return result

    except (json.JSONDecodeError, ValueError, KeyError) as e:
        print(f"[EscalationAgent] ⚠️  LLM parse error: {e}")
        return {
            "team":       "Service Desk",
            "level":      "L1",
            "confidence": 0,
            "rationale":  (
                "AI could not classify this incident with sufficient confidence. "
                "Manual human triage is required."
            ),
        }


def _build_user_message(
    summary: str,
    description: str,
    kb_context: str,
    learned_signal: str,
) -> str:

    parts = [
        f"INCIDENT SUMMARY:\n{summary}",
        f"\nINCIDENT DESCRIPTION:\n{description}",
    ]

    if kb_context:
        parts.append(f"\nKNOWLEDGE BASE MATCHES:\n{kb_context}")

    if learned_signal:
        parts.append(f"\nLEARNED SIGNAL FROM PAST REVIEWS:\n{learned_signal}")

    parts.append(
        "\nBased on the above, determine the correct team and escalation level. "
        "Respond ONLY with the JSON object."
    )

    return "\n".join(parts)
