import { apiRequest } from "./apiClient";

/**
 * Trigger AI smart escalation for a ticket.
 * POST /tickets/{issueKey}/escalate
 */
export async function triggerEscalation(issueKey) {
  return apiRequest(`/tickets/${issueKey}/escalate`, "POST");
}

/**
 * Submit human review / feedback after AI suggestion.
 * POST /tickets/{issueKey}/escalation-feedback
 * body: { human_team, human_level, human_reason, review_type }
 */
export async function submitEscalationFeedback(issueKey, payload) {
  return apiRequest(`/tickets/${issueKey}/escalation-feedback`, "POST", payload);
}

/**
 * Fetch current escalation result for a ticket (already escalated).
 * GET /tickets/{issueKey}/escalation-result
 */
export async function getEscalationResult(issueKey) {
  return apiRequest(`/tickets/${issueKey}/escalation-result`);
}
