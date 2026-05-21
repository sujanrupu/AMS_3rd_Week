# modules/copilot_rca/agent.py

import os
import json
import re

from dotenv import load_dotenv
from langchain_groq import ChatGroq

from .prompt import (
    GENERATE_PROMPT,
    SAME_ISSUE_PROMPT,
    KB_MATCH_PROMPT,
    HITL_CLARIFICATION_PROMPT,
)

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_NAME   = os.getenv("MODEL_NAME", "llama-3.3-70b-versatile")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not set in environment")

llm = ChatGroq(api_key=GROQ_API_KEY, model_name=MODEL_NAME)

# ─────────────────────────────────────────────
# GENERIC / VAGUE DESCRIPTION DETECTOR
# Checked in Python BEFORE calling the LLM.
# If a description is clearly too vague, we skip
# the LLM entirely and return LOW + HITL.
# This guarantees the LLM cannot override the rule.
# ─────────────────────────────────────────────
VAGUE_PHRASES = {
    "not working", "not work", "broken", "everything broken",
    "everything is broken", "something is wrong", "not responding",
    "issue", "problem", "error", "down", "failing", "failed",
    "doesn't work", "does not work", "stopped working", "it broke",
    "help", "urgent", "asap", "fix this", "something broke",
    "nothing works", "all broken", "system down", "service down",
    "not available", "unavailable", "crashed", "crash",
}

MIN_DESCRIPTION_WORDS = 8  # below this word count → always LOW


def _is_vague(summary: str, description: str) -> bool:
    """
    Returns True if the description is too vague for confident RCA.
    Checks:
    1. Total word count across summary + description is below minimum
    2. The combined text (stripped of punctuation) matches only generic phrases
    """
    combined = f"{summary} {description}".lower()
    combined_clean = re.sub(r"[^a-z0-9 ]", " ", combined)
    words = [w for w in combined_clean.split() if w]

    # Check 1: too short
    if len(words) < MIN_DESCRIPTION_WORDS:
        print(f"[RCAAgent] Vague check: FAILED — only {len(words)} words (min {MIN_DESCRIPTION_WORDS})")
        return True

    # Check 2: all meaningful words are generic
    # Remove articles, prepositions, pronouns before checking
    stop_words = {"the", "a", "an", "is", "are", "was", "were", "be", "been",
                  "being", "have", "has", "had", "do", "does", "did", "will",
                  "would", "could", "should", "may", "might", "shall", "can",
                  "need", "dare", "ought", "used", "to", "of", "in", "on",
                  "at", "by", "for", "with", "about", "against", "between",
                  "into", "through", "during", "before", "after", "above",
                  "below", "from", "up", "down", "out", "off", "over", "under",
                  "again", "further", "then", "once", "i", "me", "my", "we",
                  "our", "you", "your", "it", "its", "this", "that", "and",
                  "but", "or", "nor", "so", "yet", "both", "either", "neither",
                  "not", "no", "very", "also", "just", "all", "please", "hi",
                  "hello", "sir", "ma", "am", "got", "getting"}

    meaningful_words = set(words) - stop_words

    if not meaningful_words:
        print(f"[RCAAgent] Vague check: FAILED — no meaningful words")
        return True

    # If every meaningful word is in the vague phrases set
    vague_words_matched = meaningful_words & VAGUE_PHRASES
    if len(vague_words_matched) == len(meaningful_words):
        print(f"[RCAAgent] Vague check: FAILED — all words are generic: {vague_words_matched}")
        return True

    print(f"[RCAAgent] Vague check: PASSED — {len(meaningful_words)} meaningful words")
    return False


def _clean(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?", "", raw).strip()
    raw = re.sub(r"```$",          "", raw).strip()
    return raw


def is_same_issue(current: dict, past: dict) -> tuple[bool, str]:
    prompt = SAME_ISSUE_PROMPT.format(
        summary          = current.get("summary", ""),
        description      = current.get("description", ""),
        past_summary     = past.get("summary", ""),
        past_description = past.get("description", ""),
        past_root_cause  = past.get("rca_root_cause", ""),
        past_affected    = past.get("rca_affected", ""),
    )
    try:
        result = json.loads(_clean(llm.invoke(prompt).content))
        same   = bool(result.get("is_same_issue", False))
        conf   = str(result.get("confidence", "LOW")).upper()
        print(f"[RCAAgent] Same issue: {same} | {conf} | {result.get('reason','')}")
        return same, conf
    except Exception as e:
        print(f"[RCAAgent] is_same_issue failed: {e}")
        return False, "LOW"


def is_kb_applicable(current: dict, kb_entry: dict) -> tuple[bool, str]:
    prompt = KB_MATCH_PROMPT.format(
        summary       = current.get("summary", ""),
        description   = current.get("description", ""),
        kb_title      = kb_entry.get("title", ""),
        kb_symptoms   = kb_entry.get("symptoms", ""),
        kb_root_cause = kb_entry.get("root_cause", ""),
        kb_affected   = kb_entry.get("affected_component", ""),
    )
    try:
        result     = json.loads(_clean(llm.invoke(prompt).content))
        applicable = bool(result.get("is_applicable", False))
        conf       = str(result.get("confidence", "LOW")).upper()
        print(f"[RCAAgent] KB applicable: {applicable} | {conf} | {result.get('reason','')}")
        return applicable, conf
    except Exception as e:
        print(f"[RCAAgent] is_kb_applicable failed: {e}")
        return False, "LOW"


def generate_clarification_questions(current: dict) -> dict:
    prompt = HITL_CLARIFICATION_PROMPT.format(
        summary     = current.get("summary", ""),
        description = current.get("description", ""),
    )
    try:
        result = json.loads(_clean(llm.invoke(prompt).content))
        print(f"[RCAAgent] Generated {len(result.get('questions', []))} HITL questions")
        return {"questions": result.get("questions", []), "hint": result.get("hint", "")}
    except Exception as e:
        print(f"[RCAAgent] generate_clarification_questions failed: {e}")
        return {
            "questions": [
                "What exact error message or error code are you seeing?",
                "When did this issue first occur and did anything change before it started?",
                "Which specific systems or services are affected?",
                "Have you tried any troubleshooting steps? If so, what were the results?",
            ],
            "hint": "Error messages and timeline are most critical for diagnosis.",
        }


def generate_fresh_rca(current: dict) -> dict:
    """
    Two-layer RCA: technical_cause + systemic_cause.
    No resolution_steps — handled by SOP module.

    Key behaviour:
    - Vague/short descriptions are caught in Python BEFORE calling the LLM
      and immediately returned as LOW + HITL without any LLM call.
    - LOW confidence ALWAYS sets needs_human_review=True, even if LLM disagrees.
    """
    summary     = current.get("summary", "")
    description = current.get("description", "")

    # ── PRE-CHECK: catch vague descriptions before calling LLM ──
    if _is_vague(summary, description):
        print(f"[RCAAgent] Vague description detected — returning LOW without LLM call")
        clarification = generate_clarification_questions(current)
        return {
            "status":             "success",
            "root_cause":         (
                "TECHNICAL CAUSE:\n"
                "Insufficient detail to determine root cause. The description provided "
                "does not contain enough technical information to identify the specific "
                "failure mechanism, affected component, or triggering event.\n\n"
                "SYSTEMIC CAUSE:\n"
                "Systemic cause cannot be determined without more information. "
                "A problem management investigation should begin once the technical "
                "root cause is confirmed through the human review process."
            ),
            "technical_cause":    (
                "Insufficient detail to determine root cause. The description provided "
                "does not contain enough technical information to identify the specific "
                "failure mechanism, affected component, or triggering event."
            ),
            "systemic_cause":     (
                "Systemic cause cannot be determined without more information. "
                "A problem management investigation should begin once the technical "
                "root cause is confirmed through the human review process."
            ),
            "affected_component": "Unknown — insufficient description provided",
            "confidence":         "LOW",
            "needs_human_review": True,
            "clarification":      clarification,
        }

    # ── CALL LLM for descriptions with sufficient detail ──
    prompt = GENERATE_PROMPT.format(summary=summary, description=description)

    try:
        result = json.loads(_clean(llm.invoke(prompt).content))

        if "technical_cause" in result and "systemic_cause" in result:
            technical = str(result["technical_cause"]).strip()
            systemic  = str(result["systemic_cause"]).strip()
            root_cause = (
                f"TECHNICAL CAUSE:\n{technical}\n\n"
                f"SYSTEMIC CAUSE:\n{systemic}"
            )
        elif "root_cause" in result:
            root_cause = str(result["root_cause"]).strip()
            technical  = root_cause
            systemic   = None
        else:
            raise ValueError(f"Missing root cause keys. Got: {list(result.keys())}")

        confidence = str(result.get("confidence", "LOW")).upper().strip()
        if confidence not in ("HIGH", "MEDIUM", "LOW"):
            confidence = "LOW"

        # Hard enforce: LOW always triggers HITL regardless of LLM output
        needs_human_review = result.get("needs_human_review", confidence == "LOW")
        if confidence == "LOW":
            needs_human_review = True

        clarification = generate_clarification_questions(current) if needs_human_review else None

        return {
            "status":             "success",
            "root_cause":         root_cause,
            "technical_cause":    technical,
            "systemic_cause":     systemic,
            "affected_component": str(result.get("affected_component", "Unknown")).strip(),
            "confidence":         confidence,
            "needs_human_review": needs_human_review,
            "clarification":      clarification,
        }

    except Exception as e:
        print(f"[RCAAgent] generate_fresh_rca failed: {e}")
        clarification = None
        try:
            clarification = generate_clarification_questions(current)
        except Exception:
            pass
        return {
            "status":             "error",
            "root_cause":         f"RCA generation failed: {str(e)[:80]}. Manual review required.",
            "technical_cause":    "",
            "systemic_cause":     "",
            "affected_component": "Unknown — please provide more details",
            "confidence":         "LOW",
            "needs_human_review": True,
            "clarification":      clarification,
        }
