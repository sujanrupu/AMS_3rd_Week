from core.constants import (
    ESC_HIGH_THRESHOLD,
    ESC_MEDIUM_THRESHOLD,
    HITL_AUTO_BOOST_COUNT,
    HITL_BOOST_AMOUNT,
)


def get_confidence_label(confidence: int) -> str:
    if confidence >= ESC_HIGH_THRESHOLD:
        return "HIGH"
    if confidence >= ESC_MEDIUM_THRESHOLD:
        return "MEDIUM"
    return "LOW"


def get_escalation_action(confidence_label: str) -> str:
    if confidence_label == "HIGH":
        return "AUTO_ROUTED"
    if confidence_label == "MEDIUM":
        return "HITL_PENDING"
    return "QUARANTINE"


def apply_learning_boost(
    raw_confidence: int,
    feedback_count: int,
    was_corrected_count: int,
) -> int:
    if feedback_count >= HITL_AUTO_BOOST_COUNT:
        boost    = HITL_BOOST_AMOUNT
        adjusted = min(100, raw_confidence + boost)
        print(
            f"[EscalationService] 📈 Learning boost +{boost} applied "
            f"({feedback_count} human confirmations) → {raw_confidence} → {adjusted}"
        )
        return adjusted

    if was_corrected_count >= HITL_AUTO_BOOST_COUNT:
        penalty  = HITL_BOOST_AMOUNT
        adjusted = max(0, raw_confidence - penalty)
        print(
            f"[EscalationService] 📉 Learning penalty -{penalty} applied "
            f"({was_corrected_count} human corrections) → {raw_confidence} → {adjusted}"
        )
        return adjusted

    return raw_confidence


def build_learned_signal_text(
    team: str,
    level: str,
    confirmed_count: int,
    corrected_count: int,
) -> str:
    if confirmed_count >= HITL_AUTO_BOOST_COUNT:
        return (
            f"HUMAN LEARNING SIGNAL: Human reviewers have confirmed "
            f"{confirmed_count} similar incident(s) should be routed to "
            f"{team} at {level}. The AI's decision was consistently validated. "
            f"Increase confidence for this routing."
        )

    if corrected_count >= HITL_AUTO_BOOST_COUNT:
        return (
            f"HUMAN LEARNING SIGNAL: Human reviewers have corrected "
            f"{corrected_count} similar incident(s) away from {team} / {level}. "
            f"The AI was overridden consistently. Reduce confidence and flag for review."
        )

    return ""
