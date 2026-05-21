import { apiRequest } from "./apiClient";

/**
 * Run the full Priority SLA assessment on a ticket.
 *
 * @param {Object} params
 * @param {string} params.issue_key
 * @param {string} params.summary
 * @param {string} params.description
 * @param {string} params.app_name
 * @param {string} params.component_name
 * @param {string} params.impact        - user-supplied impact
 * @param {string} params.urgency       - user-supplied urgency
 *
 * @returns {Promise<Object>} assessment result from backend
 */
export async function assessPrioritySla({
  issue_key,
  summary,
  description = "",
  app_name = "",
  component_name = "",
  impact,
  urgency,
}) {
  return apiRequest("/priority-sla/assess", "POST", {
    issue_key,
    summary,
    description,
    app_name,
    component_name,
    impact,
    urgency,
  });
}

/**
 * Submit HITL details for a P1 or P2 ticket.
 *
 * @param {Object} params
 * @param {string} params.issue_key
 * @param {string} params.priority                  - must be "P1" or "P2"
 * @param {string} [params.approver_name]
 * @param {string} [params.business_justification]
 * @param {string} [params.affected_teams]
 * @param {string} [params.escalation_path]
 * @param {string} [params.comments]
 *
 * @returns {Promise<Object>} success/error response
 */
export async function submitHitlReview({
  issue_key,
  priority,
  approver_name = "",
  business_justification = "",
  affected_teams = "",
  escalation_path = "",
  comments = "",
}) {
  return apiRequest("/priority-sla/hitl-submit", "POST", {
    issue_key,
    priority,
    approver_name,
    business_justification,
    affected_teams,
    escalation_path,
    comments,
  });
}