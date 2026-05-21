import { useState, useCallback } from "react";
import { assessPrioritySla, submitHitlReview } from "../api/prioritySlaClient";

const INITIAL_HITL_FORM = {
  approver_name: "",
  business_justification: "",
  affected_teams: "",
  escalation_path: "",
  comments: "",
};

export function usePrioritySla() {
  // ── assessment result (set after assess() call or from orchestrator response)
  const [assessResult, setAssessResult]   = useState(null);
  const [assessing, setAssessing]         = useState(false);
  const [assessError, setAssessError]     = useState(null);

  // ── HITL modal state
  const [hitlOpen, setHitlOpen]           = useState(false);
  const [hitlData, setHitlData]           = useState(null);   // { issue_key, priority, ...assessResult }
  const [hitlForm, setHitlForm]           = useState(INITIAL_HITL_FORM);
  const [hitlErrors, setHitlErrors]       = useState({});
  const [hitlSubmitting, setHitlSubmitting] = useState(false);
  const [hitlSubmitted, setHitlSubmitted] = useState(false);
  const [hitlSubmitError, setHitlSubmitError] = useState(null);

  // ──────────────────────────────────────────────────────────────────────────
  // assess()
  // Call this when the orchestrator already returned a priority_sla block
  // (i.e. after /submit). You pass the block directly; no extra API call needed.
  // If requires_human_review is true, the HITL modal auto-opens.
  // ──────────────────────────────────────────────────────────────────────────
  const assess = useCallback((issueKey, prioritySlaBlock) => {
    if (!prioritySlaBlock) return;

    const result = { issue_key: issueKey, ...prioritySlaBlock };
    setAssessResult(result);

    if (result.requires_human_review) {
      _openHitlModal(result);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // assessFromApi()
  // Calls the /assess endpoint directly (e.g. from TicketCard "Re-assess" btn).
  // ──────────────────────────────────────────────────────────────────────────
  const assessFromApi = useCallback(async (params) => {
    setAssessing(true);
    setAssessError(null);

    try {
      const res = await assessPrioritySla(params);

      if (res?.type === "error" || res?.error) {
        setAssessError(res.message || "Assessment failed");
        return null;
      }

      const result = { ...res };
      setAssessResult(result);

      if (result.requires_human_review) {
        _openHitlModal(result);
      }

      return result;
    } catch (err) {
      setAssessError(err.message);
      return null;
    } finally {
      setAssessing(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // openHitl()
  // Open the HITL modal for an already-assessed P1/P2 ticket
  // (e.g. from the Tickets dashboard for an existing ticket).
  // ──────────────────────────────────────────────────────────────────────────
  const openHitl = useCallback((ticket) => {
    _openHitlModal({
      issue_key:            ticket.issue_key,
      priority:             ticket.priority,
      revalidated_impact:   ticket.revalidated_impact,
      revalidated_urgency:  ticket.revalidated_urgency,
      sla_response_time:    ticket.sla_response_time,
      sla_resolution_time:  ticket.sla_resolution_time,
      sla_description:      ticket.sla_description,
      rationale:            ticket.rationale || {},
      hitl_reviewed:        ticket.hitl_reviewed,
      hitl_approver:        ticket.hitl_approver,
    });
  }, []);

  const closeHitl = useCallback(() => {
    setHitlOpen(false);
    setHitlForm(INITIAL_HITL_FORM);
    setHitlErrors({});
    setHitlSubmitted(false);
    setHitlSubmitError(null);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // updateHitlField()
  // ──────────────────────────────────────────────────────────────────────────
  const updateHitlField = useCallback((field, value) => {
    setHitlForm((prev) => ({ ...prev, [field]: value }));
    setHitlErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // submitHitl()
  // ──────────────────────────────────────────────────────────────────────────
  const submitHitl = useCallback(async () => {
    if (!hitlData) return;

    // Validate required fields
    const errors = {};
    if (!hitlForm.approver_name.trim())
      errors.approver_name = "Approver name is required";
    if (!hitlForm.business_justification.trim())
      errors.business_justification = "Business justification is required";

    if (Object.keys(errors).length) {
      setHitlErrors(errors);
      return;
    }

    setHitlSubmitting(true);
    setHitlSubmitError(null);

    try {
      const res = await submitHitlReview({
        issue_key:              hitlData.issue_key,
        priority:               hitlData.priority,
        approver_name:          hitlForm.approver_name,
        business_justification: hitlForm.business_justification,
        affected_teams:         hitlForm.affected_teams,
        escalation_path:        hitlForm.escalation_path,
        comments:               hitlForm.comments,
      });

      if (res?.type === "error" || res?.error) {
        setHitlSubmitError(res.message || "Submission failed");
        return;
      }

      setHitlSubmitted(true);
    } catch (err) {
      setHitlSubmitError(err.message);
    } finally {
      setHitlSubmitting(false);
    }
  }, [hitlData, hitlForm]);

  // ── internal helper ───────────────────────────────────────────────────────
  function _openHitlModal(data) {
    setHitlData(data);
    setHitlForm(INITIAL_HITL_FORM);
    setHitlErrors({});
    setHitlSubmitted(false);
    setHitlSubmitError(null);
    setHitlOpen(true);
  }

  return {
    // assessment
    assessResult,
    assessing,
    assessError,
    assess,
    assessFromApi,

    // HITL modal
    hitlOpen,
    hitlData,
    hitlForm,
    hitlErrors,
    hitlSubmitting,
    hitlSubmitted,
    hitlSubmitError,
    openHitl,
    closeHitl,
    updateHitlField,
    submitHitl,
  };
}