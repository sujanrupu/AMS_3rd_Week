PRIORITY_MATRIX = {
    ("Extensive",   "Critical"): "P1",
    ("Extensive",   "High"):     "P1",
    ("Extensive",   "Medium"):   "P2",
    ("Extensive",   "Low"):      "P3",

    ("Significant", "Critical"): "P1",
    ("Significant", "High"):     "P2",
    ("Significant", "Medium"):   "P3",
    ("Significant", "Low"):      "P3",

    ("Moderate",    "Critical"): "P2",
    ("Moderate",    "High"):     "P3",
    ("Moderate",    "Medium"):   "P3",
    ("Moderate",    "Low"):      "P4",

    ("Minor",       "Critical"): "P3",
    ("Minor",       "High"):     "P3",
    ("Minor",       "Medium"):   "P4",
    ("Minor",       "Low"):      "P4",
}


# ────────────────────────────────────────────
# SLA RULES (per Priority)
# ────────────────────────────────────────────
SLA_RULES = {
    "P1": {
        "response_time":   "15 minutes",
        "resolution_time": "4 hours",
        "description":     "Critical — Immediate response. Major business disruption.",
        "human_review":    True,   # HITL required
    },
    "P2": {
        "response_time":   "1 hour",
        "resolution_time": "8 hours",
        "description":     "High — Prompt response. Significant impact on operations.",
        "human_review":    True,   # HITL required
    },
    "P3": {
        "response_time":   "4 hours",
        "resolution_time": "3 business days",
        "description":     "Medium — Standard response. Moderate or limited impact.",
        "human_review":    False,
    },
    "P4": {
        "response_time":   "1 business day",
        "resolution_time": "5 business days",
        "description":     "Low — Routine response. Minimal impact.",
        "human_review":    False,
    },
}


# ────────────────────────────────────────────
# VALID VALUES
# ────────────────────────────────────────────
VALID_IMPACTS  = ["Extensive", "Significant", "Moderate", "Minor"]
VALID_URGENCIES = ["Critical", "High", "Medium", "Low"]


# ────────────────────────────────────────────
# CONFIDENCE THRESHOLDS
# ────────────────────────────────────────────
# >= HIGH_THRESHOLD → accept KB-revalidated value (high confidence)
# >= MED_THRESHOLD  → accept but flag as medium confidence
# < MED_THRESHOLD   → fall back to user-provided value (low confidence)

CONFIDENCE_HIGH_THRESHOLD = 75   # score >= 75 → strong revalidation
CONFIDENCE_MED_THRESHOLD  = 50   # score >= 50 → moderate revalidation


# ────────────────────────────────────────────
# CORE FUNCTIONS
# ────────────────────────────────────────────

def get_priority(impact: str, urgency: str) -> str | None:
    """Map revalidated impact + urgency → priority using the priority matrix."""
    key = (impact.strip().capitalize(), urgency.strip().capitalize())
    return PRIORITY_MATRIX.get(key)


def get_sla(priority: str) -> dict:
    """Return SLA rules dict for a given priority level."""
    return SLA_RULES.get(priority, {})


def requires_human_review(priority: str) -> bool:
    """Return True if this priority requires HITL (P1 or P2)."""
    return SLA_RULES.get(priority, {}).get("human_review", False)


def compute_confidence_score(kb_matches: list) -> int:
    """
    Derive a 0–100 confidence score from KB vector similarity matches.

    - Top match similarity drives the base score.
    - Agreement between top matches boosts confidence.
    - Disagreement reduces confidence.
    """
    if not kb_matches:
        return 0

    # Base: top match similarity → 0-100 scale
    top_similarity = kb_matches[0].get("similarity", 0)
    base_score = int(top_similarity * 100)

    if len(kb_matches) < 2:
        return base_score

    # Check agreement among top matches (up to 3)
    top_labels = [m.get("revalidated_impact") or m.get("revalidated_urgency")
                  for m in kb_matches[:3]]
    top_labels = [l for l in top_labels if l]

    if not top_labels:
        return base_score

    majority_label = max(set(top_labels), key=top_labels.count)
    agreement_ratio = top_labels.count(majority_label) / len(top_labels)

    # Boost or penalise based on agreement
    if agreement_ratio == 1.0:
        base_score = min(100, base_score + 8)    # full agreement → +8
    elif agreement_ratio >= 0.67:
        base_score = min(100, base_score + 3)    # majority agreement → +3
    else:
        base_score = max(0, base_score - 10)     # disagreement → -10

    return base_score


def get_confidence_label(score: int) -> str:
    if score >= CONFIDENCE_HIGH_THRESHOLD:
        return "HIGH"
    if score >= CONFIDENCE_MED_THRESHOLD:
        return "MEDIUM"
    return "LOW"


def pick_revalidated_value(
    kb_matches: list,
    user_value: str,
    field: str,           # "revalidated_impact" or "revalidated_urgency"
    confidence_score: int,
) -> tuple[str, bool]:
    """
    Decide the final revalidated value and whether user's value was changed.

    Returns:
        (final_value, was_changed)
    """
    if not kb_matches or confidence_score < CONFIDENCE_MED_THRESHOLD:
        # Not enough confidence → keep user's value
        return user_value, False

    # Weighted vote across top matches
    votes: dict[str, float] = {}
    for match in kb_matches[:5]:
        label = match.get(field)
        sim   = match.get("similarity", 0)
        if label:
            votes[label] = votes.get(label, 0.0) + sim

    if not votes:
        return user_value, False

    best_label = max(votes, key=votes.get)
    was_changed = best_label != user_value

    return best_label, was_changed