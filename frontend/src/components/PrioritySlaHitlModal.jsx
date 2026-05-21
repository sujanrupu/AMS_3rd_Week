export default function PrioritySlaHitlModal({
  hitlData,
  hitlForm,
  hitlErrors = {},
  hitlSubmitting = false,
  hitlSubmitted = false,
  hitlSubmitError = null,
  onFieldChange,
  onSubmit,
  onClose,
}) {
  if (!hitlData) return null;

  const isP1 = hitlData.priority === "P1";

  const priorityColor = isP1
    ? { ring: "rgba(239,68,68,0.5)", bg: "rgba(239,68,68,0.1)", text: "#f87171", border: "rgba(239,68,68,0.3)" }
    : { ring: "rgba(251,146,60,0.5)", bg: "rgba(251,146,60,0.1)", text: "#fb923c", border: "rgba(251,146,60,0.3)" };

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={hitlSubmitted ? onClose : undefined}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(4px)",
          zIndex: 9998,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
        }}
      >
        {/* ── Modal Card ── */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: "640px",
            background: "linear-gradient(145deg, #151b2b 0%, #0f1420 100%)",
            border: `1px solid ${priorityColor.border}`,
            borderRadius: "20px",
            boxShadow: `0 0 0 1px ${priorityColor.ring}, 0 24px 60px rgba(0,0,0,0.6)`,
            overflow: "hidden",
            zIndex: 9999,
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          {/* ── Header ── */}
          <div style={{
            padding: "20px 24px 16px",
            borderBottom: `1px solid ${priorityColor.border}`,
            background: `linear-gradient(90deg, ${priorityColor.bg} 0%, transparent 100%)`,
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Priority badge */}
              <div style={{
                width: "44px", height: "44px", borderRadius: "12px",
                background: priorityColor.bg,
                border: `1px solid ${priorityColor.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <span style={{ fontSize: "1.1rem" }}>{isP1 ? "🔴" : "🟠"}</span>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{
                    fontFamily: "monospace", fontSize: "0.7rem", fontWeight: 700,
                    letterSpacing: "0.08em", padding: "2px 8px", borderRadius: "6px",
                    background: priorityColor.bg, color: priorityColor.text,
                    border: `1px solid ${priorityColor.border}`,
                  }}>
                    {hitlData.priority}
                  </span>
                  <span style={{
                    fontFamily: "monospace", fontSize: "0.7rem",
                    color: "#64748b", letterSpacing: "0.04em",
                  }}>
                    {hitlData.issue_key}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#f1f5f9" }}>
                  Human Review Required
                </h2>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "#94a3b8", marginTop: "2px" }}>
                  {isP1
                    ? "Critical ticket — immediate human review needed before routing"
                    : "High-priority ticket — human confirmation required before routing"}
                </p>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#475569", padding: "4px", borderRadius: "6px",
                lineHeight: 1, fontSize: "1.2rem", flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: "20px 24px" }}>

            {/* ── Priority + SLA Summary ── */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: "10px", marginBottom: "20px",
            }}>
              {[
                { label: "Impact",    value: hitlData.revalidated_impact  || "—" },
                { label: "Urgency",   value: hitlData.revalidated_urgency || "—" },
                { label: "Response",  value: hitlData.sla_response_time   || "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: "rgba(15,20,32,0.8)",
                  border: "1px solid rgba(139,92,246,0.15)",
                  borderRadius: "10px", padding: "10px 12px",
                }}>
                  <div style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#e2e8f0" }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* ── AI Rationale (if available) ── */}
            {(hitlData.rationale?.impact || hitlData.rationale?.urgency) && (
              <div style={{
                background: "rgba(139,92,246,0.06)",
                border: "1px solid rgba(139,92,246,0.15)",
                borderRadius: "10px", padding: "12px 14px", marginBottom: "20px",
              }}>
                <div style={{ fontSize: "0.65rem", color: "#a78bfa", fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px",
                  display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🤖</span> AI Assessment Rationale
                </div>
                {hitlData.rationale?.impact && (
                  <div style={{ marginBottom: "6px" }}>
                    <span style={{ fontSize: "0.65rem", color: "#7c3aed", fontWeight: 600 }}>Impact: </span>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{hitlData.rationale.impact}</span>
                  </div>
                )}
                {hitlData.rationale?.urgency && (
                  <div>
                    <span style={{ fontSize: "0.65rem", color: "#7c3aed", fontWeight: 600 }}>Urgency: </span>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{hitlData.rationale.urgency}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Success State ── */}
            {hitlSubmitted ? (
              <div style={{
                textAlign: "center", padding: "32px 16px",
              }}>
                <div style={{
                  width: "56px", height: "56px", borderRadius: "50%",
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <span style={{ fontSize: "1.5rem" }}>✓</span>
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 700, color: "#4ade80" }}>
                  Human Review Recorded
                </h3>
                <p style={{ margin: "0 0 20px", fontSize: "0.8rem", color: "#64748b" }}>
                  The ticket has been confirmed and will proceed to the next pipeline stage.
                </p>
                <button
                  onClick={onClose}
                  style={{
                    padding: "10px 28px", borderRadius: "10px",
                    background: "linear-gradient(135deg, #7c3aed, #2563eb)",
                    border: "none", color: "#fff", fontSize: "0.85rem",
                    fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              /* ── HITL Form ── */
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* Approver */}
                <FormField
                  label="Approver"
                  required
                  error={hitlErrors.approver_name}
                >
                  <input
                    type="text"
                    placeholder="Your full name"
                    value={hitlForm.approver_name}
                    onChange={(e) => onFieldChange("approver_name", e.target.value)}
                    style={inputStyle(!!hitlErrors.approver_name)}
                  />
                </FormField>

                {/* Business Justification */}
                <FormField
                  label="Business Justification"
                  required
                  error={hitlErrors.business_justification}
                  hint="Why does this ticket require this priority level?"
                >
                  <textarea
                    rows={3}
                    placeholder="Describe the business impact and why this needs immediate attention..."
                    value={hitlForm.business_justification}
                    onChange={(e) => onFieldChange("business_justification", e.target.value)}
                    style={{ ...inputStyle(!!hitlErrors.business_justification), resize: "vertical" }}
                  />
                </FormField>

                {/* Affected Teams */}
                <FormField
                  label="Affected Teams"
                  hint="Comma-separated: e.g. Platform, DevOps, Customer Success"
                >
                  <input
                    type="text"
                    placeholder="e.g. Platform, DevOps, Customer Success"
                    value={hitlForm.affected_teams}
                    onChange={(e) => onFieldChange("affected_teams", e.target.value)}
                    style={inputStyle(false)}
                  />
                </FormField>

                {/* Escalation Path */}
                <FormField
                  label="Escalation Path"
                  hint="Who should be notified / on-call chain"
                >
                  <input
                    type="text"
                    placeholder="e.g. L2 Support → Engineering Manager → VP Engineering"
                    value={hitlForm.escalation_path}
                    onChange={(e) => onFieldChange("escalation_path", e.target.value)}
                    style={inputStyle(false)}
                  />
                </FormField>

                {/* Comments */}
                <FormField label="Additional Comments">
                  <textarea
                    rows={2}
                    placeholder="Any additional context for the resolver team..."
                    value={hitlForm.comments}
                    onChange={(e) => onFieldChange("comments", e.target.value)}
                    style={{ ...inputStyle(false), resize: "vertical" }}
                  />
                </FormField>

                {/* Submit Error */}
                {hitlSubmitError && (
                  <div style={{
                    padding: "10px 14px", borderRadius: "8px",
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    fontSize: "0.75rem", color: "#f87171",
                  }}>
                    ⚠ {hitlSubmitError}
                  </div>
                )}

                {/* Footer Buttons */}
                <div style={{
                  display: "flex", gap: "10px", justifyContent: "flex-end",
                  paddingTop: "4px",
                }}>
                  <button
                    onClick={onClose}
                    disabled={hitlSubmitting}
                    style={{
                      padding: "10px 20px", borderRadius: "10px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#94a3b8", fontSize: "0.82rem",
                      fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSubmit}
                    disabled={hitlSubmitting}
                    style={{
                      padding: "10px 24px", borderRadius: "10px",
                      background: hitlSubmitting
                        ? "rgba(100,116,139,0.4)"
                        : `linear-gradient(135deg, ${isP1 ? "#dc2626, #9f1239" : "#ea580c, #9a3412"})`,
                      border: "none", color: "#fff",
                      fontSize: "0.82rem", fontWeight: 700,
                      cursor: hitlSubmitting ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: "8px",
                    }}
                  >
                    {hitlSubmitting ? (
                      <>
                        <SpinnerIcon />
                        Submitting...
                      </>
                    ) : (
                      `Confirm ${hitlData.priority} Review`
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function FormField({ label, required, error, hint, children }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: "0.65rem", fontWeight: 600,
        color: error ? "#f87171" : "#94a3b8",
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px",
      }}>
        {label} {required && <span style={{ color: "#f87171" }}>*</span>}
      </label>
      {children}
      {hint && !error && (
        <p style={{ margin: "4px 0 0", fontSize: "0.65rem", color: "#475569" }}>{hint}</p>
      )}
      {error && (
        <p style={{ margin: "4px 0 0", fontSize: "0.65rem", color: "#f87171" }}>{error}</p>
      )}
    </div>
  );
}

function inputStyle(hasError) {
  return {
    width: "100%", boxSizing: "border-box",
    padding: "10px 12px",
    background: "rgba(15,20,32,0.8)",
    border: `1px solid ${hasError ? "rgba(239,68,68,0.4)" : "rgba(100,116,139,0.25)"}`,
    borderRadius: "10px",
    color: "#e2e8f0", fontSize: "0.82rem",
    outline: "none",
    fontFamily: "inherit",
  };
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.5} style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}