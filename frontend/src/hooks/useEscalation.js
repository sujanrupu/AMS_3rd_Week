import { useState, useCallback } from "react";
import {
  triggerEscalation,
  submitEscalationFeedback,
  getEscalationResult,
} from "../api/escalationClient";

export function useEscalation() {
  const [modal,      setModal]      = useState(null);   // { issueKey, ticket }
  const [phase,      setPhase]      = useState("idle");
  const [result,     setResult]     = useState(null);   // AI escalation result
  const [error,      setError]      = useState(null);
  const [hitlForm,   setHitlForm]   = useState({
    human_team:   "",
    human_level:  "",
    human_reason: "",
  });
  const [hitlErrors, setHitlErrors] = useState({});

  // ── Open modal & immediately trigger AI ──────────────────────────────
  const openEscalation = useCallback(async (issueKey, ticket) => {
    setModal({ issueKey, ticket });
    setPhase("loading");
    setResult(null);
    setError(null);
    setHitlForm({ human_team: "", human_level: "", human_reason: "" });
    setHitlErrors({});

    const res = await triggerEscalation(issueKey);

    if (!res || res.error) {
      setError(res?.message || "AI escalation failed. Please try again.");
      setPhase("error");
      return;
    }

    setResult(res);

    // HIGH confidence → auto-escalated, just show result
    // MEDIUM / LOW → show HITL prompt
    const confidence = (res.esc_confidence || "").toUpperCase();
    if (confidence === "HIGH") {
      setPhase("result");
    } else {
      // MEDIUM or LOW → land on result first, user clicks "Review"
      setPhase("result");
    }
  }, []);

  // ── If ticket already escalated, just fetch & show result ────────────
  const openExistingEscalation = useCallback(async (issueKey, ticket) => {
    setModal({ issueKey, ticket });
    setPhase("loading");
    setResult(null);
    setError(null);
    setHitlForm({ human_team: "", human_level: "", human_reason: "" });
    setHitlErrors({});

    const res = await getEscalationResult(issueKey);

    if (!res || res.error) {
      setError(res?.message || "Could not load escalation result.");
      setPhase("error");
      return;
    }

    setResult(res);
    setPhase("result");
  }, []);

  // ── Close & reset ─────────────────────────────────────────────────────
  const closeEscalation = useCallback(() => {
    setModal(null);
    setPhase("idle");
    setResult(null);
    setError(null);
    setHitlForm({ human_team: "", human_level: "", human_reason: "" });
    setHitlErrors({});
  }, []);

  // ── Enter HITL review form ────────────────────────────────────────────
  const enterHitlForm = useCallback(() => {
    // Pre-fill with AI suggestion so human can keep or change
    setHitlForm({
      human_team:   result?.esc_team   || "",
      human_level:  result?.esc_level  || "",
      human_reason: "",
    });
    setHitlErrors({});
    setPhase("hitl_form");
  }, [result]);

  // ── Update HITL form field ────────────────────────────────────────────
  const updateHitlField = useCallback((field, value) => {
    setHitlForm(prev => ({ ...prev, [field]: value }));
    setHitlErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);

  // ── Validate HITL form ────────────────────────────────────────────────
  const validateHitl = () => {
    const errs = {};
    if (!hitlForm.human_team.trim())   errs.human_team   = "Team is required";
    if (!hitlForm.human_level.trim())  errs.human_level  = "Level is required";
    if (!hitlForm.human_reason.trim()) errs.human_reason = "Rationale is required";
    return errs;
  };

  // ── Submit HITL feedback → KB self-learning ───────────────────────────
  const submitHitl = useCallback(async (reviewType = "hitl_review") => {
    const errs = validateHitl();
    if (Object.keys(errs).length) {
      setHitlErrors(errs);
      return;
    }

    setPhase("submitting");

    const payload = {
      human_team:   hitlForm.human_team.trim(),
      human_level:  hitlForm.human_level.trim().toUpperCase(),
      human_reason: hitlForm.human_reason.trim(),
      review_type:  reviewType,
    };

    const res = await submitEscalationFeedback(modal.issueKey, payload);

    if (!res || res.error) {
      setError(res?.message || "Failed to save review. Please try again.");
      setPhase("hitl_form");
      return;
    }

    // Update result to reflect final human decision
    setResult(prev => ({
      ...prev,
      esc_team:       payload.human_team,
      esc_level:      payload.human_level,
      esc_confidence: prev?.esc_confidence || "HUMAN_REVIEWED",
      esc_action:     "HUMAN_FINALISED",
      esc_rationale:  payload.human_reason,
    }));

    setPhase("done");
  }, [hitlForm, modal]);

  const isHighConfidence = result
    ? (result.esc_confidence || "").toUpperCase() === "HIGH"
    : false;

  const isMediumOrLow = result
    ? ["MEDIUM", "LOW"].includes((result.esc_confidence || "").toUpperCase())
    : false;

  const isAutoEscalated = result
    ? result.esc_action === "AUTO_ROUTED"
    : false;

  const isHumanFinalised = result
    ? result.esc_action === "HUMAN_FINALISED"
    : false;

  const isQuarantine = result
    ? result.esc_action === "QUARANTINE"
    : false;

  // ── Go back from HITL form to result view ───────────────────────────
  const exitHitlForm = useCallback(() => {
    setPhase("result");
    setHitlErrors({});
  }, []);

  return {
    // modal control
    modal,
    openEscalation,
    openExistingEscalation,
    closeEscalation,

    // state
    phase,
    result,
    error,

    // HITL form
    hitlForm,
    hitlErrors,
    enterHitlForm,
    exitHitlForm,
    updateHitlField,
    submitHitl,

    // computed
    isHighConfidence,
    isMediumOrLow,
    isAutoEscalated,
    isHumanFinalised,
    isQuarantine,
  };
}
