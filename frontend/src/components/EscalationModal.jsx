import { useEffect, useRef } from "react";

const TEAMS = [
  "Service Desk",
  "Network Ops",
  "DBA Team",
  "App Support",
  "DevOps",
  "Platform Infra",
  "Cloud Ops",
  "Security Ops",
];

const LEVELS = ["L1", "L2", "L3"];

const LEVEL_META = {
  L1: { label: "L1 · Service Desk",     color: "#facc15", bg: "rgba(250,204,21,0.10)",  border: "rgba(250,204,21,0.25)" },
  L2: { label: "L2 · Specialist",       color: "#60a5fa", bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.25)" },
  L3: { label: "L3 · Engineering Lead", color: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.25)" },
};

const CONF_META = {
  HIGH:   { color: "#4ade80", bg: "rgba(74,222,128,0.10)",  border: "rgba(74,222,128,0.25)",  label: "HIGH" },
  MEDIUM: { color: "#facc15", bg: "rgba(250,204,21,0.10)",  border: "rgba(250,204,21,0.25)",  label: "MEDIUM" },
  LOW:    { color: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.25)", label: "LOW" },
};

const ACTION_META = {
  AUTO_ROUTED:     { label: "Auto-Escalated",    color: "#4ade80", icon: "✦" },
  HITL_PENDING:    { label: "Human Review Req.", color: "#facc15", icon: "◆" },
  QUARANTINE:      { label: "Quarantine",         color: "#f87171", icon: "⚠" },
  HUMAN_FINALISED: { label: "Human Finalised",   color: "#a78bfa", icon: "✔" },
};

/* ── Loading spinner ── */
function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "40px 0" }}>
      <div className="esc-spinner" />
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem", color: "#94a3b8", letterSpacing: "0.06em" }}>
        AI is analysing the incident…
      </div>
      <div style={{ fontSize: "0.65rem", color: "#475569", maxWidth: 260, textAlign: "center", lineHeight: 1.6 }}>
        Searching knowledge base and building routing decision
      </div>
    </div>
  );
}

/* ── Confidence meter ── */
function ConfBar({ confidence, level }) {
  const meta = CONF_META[level] || CONF_META.LOW;
  const pct  = Math.round(confidence || 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          AI Confidence
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem", fontWeight: 700, color: meta.color }}>
          {pct}% · {meta.label}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 99,
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${meta.color}88, ${meta.color})`,
          transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
        }} />
      </div>
    </div>
  );
}

/* ── Result card ── */
function ResultCard({ result, isHighConfidence, isMediumOrLow, isQuarantine, isHumanFinalised, phase, enterHitlForm, onClose }) {
  const confKey  = (result?.esc_confidence || "LOW").toUpperCase();
  const action   = result?.esc_action || "HITL_PENDING";
  const actMeta  = ACTION_META[action] || ACTION_META.HITL_PENDING;
  const lvlKey   = (result?.esc_level  || "L1").toUpperCase();
  const lvlMeta  = LEVEL_META[lvlKey]  || LEVEL_META.L1;
  const isDone   = phase === "done";
  const confPct  = result?.esc_confidence_raw ?? (confKey === "HIGH" ? 92 : confKey === "MEDIUM" ? 74 : 40);

  return (
    <div className="esc-result-card">
      {/* Action badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.04em",
          padding: "4px 12px", borderRadius: 999,
          color: actMeta.color,
          background: `${actMeta.color}18`,
          border: `1px solid ${actMeta.color}44`,
        }}>
          <span>{actMeta.icon}</span> {actMeta.label}
        </span>
        {isDone && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem",
            fontWeight: 600, padding: "3px 10px",
            borderRadius: 999, color: "#4ade80",
            background: "rgba(74,222,128,0.10)", border: "1px solid rgba(74,222,128,0.25)",
          }}>
            ✦ KB Updated
          </span>
        )}
      </div>

      {/* Team + Level */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div className="esc-stat-box">
          <div className="esc-stat-label">Assigned Team</div>
          <div className="esc-stat-value" style={{ color: "#c4b5fd" }}>{result?.esc_team || "—"}</div>
        </div>
        <div className="esc-stat-box">
          <div className="esc-stat-label">Escalation Level</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.82rem", fontWeight: 700, color: lvlMeta.color }}>
            {lvlKey}
            <span style={{ fontSize: "0.58rem", fontWeight: 400, color: "#64748b", marginLeft: 6 }}>
              {lvlKey === "L1" ? "Service Desk" : lvlKey === "L2" ? "Specialist" : "Engineering Lead"}
            </span>
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <div style={{ marginBottom: 14 }}>
        <ConfBar confidence={confPct} level={confKey} />
      </div>

      {/* Rationale */}
      <div className="esc-rationale-box">
        <div className="esc-stat-label" style={{ marginBottom: 6 }}>AI Rationale</div>
        <p style={{ fontSize: "0.72rem", color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>
          {result?.esc_rationale || "No rationale provided."}
        </p>
      </div>

      {/* HIGH — auto routed, no action needed */}
      {!isDone && isHighConfidence && !isHumanFinalised && (
        <div className="esc-cta-row">
          <div style={{ fontSize: "0.65rem", color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, padding: "8px 14px", flex: 1, lineHeight: 1.5 }}>
            ✦ High confidence — auto-routed to <strong style={{ color: "#4ade80" }}>{result?.esc_team}</strong> at <strong style={{ color: "#4ade80" }}>{lvlKey}</strong>. No action needed.
          </div>
          <button className="esc-btn esc-btn-ghost" onClick={onClose}>Close</button>
        </div>
      )}

      {/* MEDIUM — human review is MANDATORY, no Later */}
      {!isDone && isMediumOrLow && !isHumanFinalised && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: "0.65rem", color: "#facc15", background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", borderRadius: 10, padding: "10px 14px", lineHeight: 1.6 }}>
            <strong style={{ color: "#facc15", display: "block", marginBottom: 3 }}>◆ Human Review Required</strong>
            AI has suggested a routing but confidence is not high enough to auto-route.
            You <strong style={{ color: "#facc15" }}>must complete the human review</strong> — the ticket will not be escalated until you do.
          </div>
          <button className="esc-btn esc-btn-primary" style={{ width: "100%" }} onClick={enterHitlForm}>
            ◆ Start Human Review — Required
          </button>
        </div>
      )}

      {/* QUARANTINE — full triage mandatory, no Later */}
      {!isDone && isQuarantine && !isHumanFinalised && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: "0.65rem", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, padding: "10px 14px", lineHeight: 1.6 }}>
            <strong style={{ color: "#f87171", display: "block", marginBottom: 3 }}>⚠ Quarantine — Full Triage Required</strong>
            AI confidence is too low to suggest any routing. You <strong style={{ color: "#f87171" }}>must complete the triage form</strong> — the ticket will remain unrouted until you do.
          </div>
          <button className="esc-btn esc-btn-danger" style={{ width: "100%" }} onClick={enterHitlForm}>
            ⚠ Begin Quarantine Triage — Required
          </button>
        </div>
      )}

      {/* DONE or already human finalised */}
      {(isDone || isHumanFinalised) && (
        <div className="esc-cta-row">
          <div style={{ fontSize: "0.65rem", color: "#a78bfa", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10, padding: "8px 14px", flex: 1, lineHeight: 1.5 }}>
            ✔ Human review saved — knowledge base has been updated with this decision.
          </div>
          <button className="esc-btn esc-btn-ghost" onClick={onClose}>Done</button>
        </div>
      )}
    </div>
  );
}

/* ── MEDIUM confidence HITL form ── */
function HitlFormMedium({ hitlForm, hitlErrors, updateHitlField, submitHitl, phase, onBack }) {
  const loading = phase === "submitting";
  return (
    <div className="esc-hitl-form">
      {/* Header */}
      <div style={{
        padding: "10px 14px", borderRadius: 12,
        background: "rgba(250,204,21,0.07)", border: "1px solid rgba(250,204,21,0.2)",
        marginBottom: 4,
      }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", color: "#facc15", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
          ◆ Human Review — Medium Confidence
        </div>
        <p style={{ fontSize: "0.68rem", color: "#94a3b8", margin: 0, lineHeight: 1.55 }}>
          The AI has suggested a team and level. You may <strong style={{ color: "#e2e8f0" }}>keep</strong> the AI's suggestion or <strong style={{ color: "#e2e8f0" }}>change</strong> it.
          Either way, your decision and reason will be saved to the KB to improve future routing.
        </p>
      </div>

      {/* Team */}
      <div className="esc-field">
        <label className="esc-label">Select Final Team *</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
          {TEAMS.map(t => (
            <button
              key={t}
              className={`esc-team-chip ${hitlForm.human_team === t ? "active" : ""}`}
              onClick={() => updateHitlField("human_team", t)}
              disabled={loading}
            >{t}</button>
          ))}
        </div>
        {hitlErrors.human_team && <div className="esc-field-err">{hitlErrors.human_team}</div>}
      </div>

      {/* Level */}
      <div className="esc-field">
        <label className="esc-label">Select Escalation Level *</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {LEVELS.map(l => {
            const m = LEVEL_META[l];
            return (
              <button
                key={l}
                className={`esc-level-chip ${hitlForm.human_level === l ? "active" : ""}`}
                style={hitlForm.human_level === l ? { color: m.color, background: m.bg, borderColor: m.border } : {}}
                onClick={() => updateHitlField("human_level", l)}
                disabled={loading}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "0.75rem" }}>{l}</span>
                <span style={{ fontSize: "0.55rem", color: hitlForm.human_level === l ? m.color : "#64748b", display: "block", marginTop: 2 }}>
                  {l === "L1" ? "Service Desk" : l === "L2" ? "Specialist" : "Engineering"}
                </span>
              </button>
            );
          })}
        </div>
        {hitlErrors.human_level && <div className="esc-field-err">{hitlErrors.human_level}</div>}
      </div>

      {/* Rationale */}
      <div className="esc-field">
        <label className="esc-label">Reason — Did you keep or change the AI suggestion? *</label>
        <textarea
          className={`esc-textarea ${hitlErrors.human_reason ? "has-error" : ""}`}
          rows={3}
          placeholder="e.g. 'Agreed with AI — this is a standard L1 password reset' or 'Changed to DevOps L2 — this requires a deployment rollback which Service Desk cannot do'…"
          value={hitlForm.human_reason}
          onChange={e => updateHitlField("human_reason", e.target.value)}
          disabled={loading}
        />
        {hitlErrors.human_reason && <div className="esc-field-err">{hitlErrors.human_reason}</div>}
      </div>

      {/* KB notice */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}>
        <span style={{ fontSize: "0.75rem", marginTop: 1 }}>🧠</span>
        <p style={{ margin: 0, fontSize: "0.65rem", color: "#94a3b8", lineHeight: 1.6 }}>
          Clicking <strong style={{ color: "#c4b5fd" }}>Submit &amp; Update KB</strong> is <strong style={{ color: "#c4b5fd" }}>mandatory</strong>. This saves your decision and immediately enriches the AI knowledge base. Future similar incidents will benefit from your review.
        </p>
      </div>

      <div className="esc-cta-row">
        <button className="esc-btn esc-btn-kb" onClick={() => submitHitl("hitl_review")} disabled={loading}>
          {loading ? <><span className="esc-btn-spinner" /> Saving…</> : <><span>🧠</span> Submit &amp; Update KB</>}
        </button>
        <button className="esc-btn esc-btn-ghost" onClick={onBack} disabled={loading}>← Back</button>
      </div>
    </div>
  );
}

/* ── QUARANTINE triage form ── */
function HitlFormQuarantine({ hitlForm, hitlErrors, updateHitlField, submitHitl, phase, onBack }) {
  const loading = phase === "submitting";
  return (
    <div className="esc-hitl-form">
      {/* Header */}
      <div style={{
        padding: "10px 14px", borderRadius: 12,
        background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.22)",
        marginBottom: 4,
      }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", color: "#f87171", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
          ⚠ Quarantine Triage — Full Human Decision Required
        </div>
        <p style={{ fontSize: "0.68rem", color: "#94a3b8", margin: 0, lineHeight: 1.55 }}>
          The AI could not determine the correct routing with sufficient confidence. As a human expert, you must
          <strong style={{ color: "#e2e8f0" }}> fully analyse this incident</strong> and decide the team and level independently.
          The AI has <strong style={{ color: "#f87171" }}>not pre-filled</strong> any suggestion — this is your decision entirely.
        </p>
      </div>

      {/* Incident reminder */}
      <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.55rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
          Triage Checklist
        </div>
        <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: "0.68rem", color: "#64748b", lineHeight: 1.7 }}>
          <li>Is this a security incident? → Security Ops, L3</li>
          <li>Is production fully down? → App Support, L3</li>
          <li>Is this a database/data issue? → DBA Team, L2 or L3</li>
          <li>Is this a network/VPN issue? → Network Ops, L2</li>
          <li>Is this a simple user request? → Service Desk, L1</li>
        </ul>
      </div>

      {/* Team */}
      <div className="esc-field">
        <label className="esc-label">Assign to Team *</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
          {TEAMS.map(t => (
            <button
              key={t}
              className={`esc-team-chip ${hitlForm.human_team === t ? "active" : ""}`}
              onClick={() => updateHitlField("human_team", t)}
              disabled={loading}
            >{t}</button>
          ))}
        </div>
        {hitlErrors.human_team && <div className="esc-field-err">{hitlErrors.human_team}</div>}
      </div>

      {/* Level */}
      <div className="esc-field">
        <label className="esc-label">Escalation Level *</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {LEVELS.map(l => {
            const m = LEVEL_META[l];
            return (
              <button
                key={l}
                className={`esc-level-chip ${hitlForm.human_level === l ? "active" : ""}`}
                style={hitlForm.human_level === l ? { color: m.color, background: m.bg, borderColor: m.border } : {}}
                onClick={() => updateHitlField("human_level", l)}
                disabled={loading}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "0.75rem" }}>{l}</span>
                <span style={{ fontSize: "0.55rem", color: hitlForm.human_level === l ? m.color : "#64748b", display: "block", marginTop: 2 }}>
                  {l === "L1" ? "Service Desk" : l === "L2" ? "Specialist" : "Engineering"}
                </span>
              </button>
            );
          })}
        </div>
        {hitlErrors.human_level && <div className="esc-field-err">{hitlErrors.human_level}</div>}
      </div>

      {/* Rationale */}
      <div className="esc-field">
        <label className="esc-label">Your Triage Analysis *</label>
        <textarea
          className={`esc-textarea ${hitlErrors.human_reason ? "has-error" : ""}`}
          rows={4}
          placeholder="Explain your full triage analysis — what type of incident is this, why did you pick this team and level, what indicators led to your decision? This is critical for KB learning…"
          value={hitlForm.human_reason}
          onChange={e => updateHitlField("human_reason", e.target.value)}
          disabled={loading}
        />
        {hitlErrors.human_reason && <div className="esc-field-err">{hitlErrors.human_reason}</div>}
      </div>

      {/* KB notice */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.18)" }}>
        <span style={{ fontSize: "0.75rem", marginTop: 1 }}>🧠</span>
        <p style={{ margin: 0, fontSize: "0.65rem", color: "#94a3b8", lineHeight: 1.6 }}>
          Your triage decision is <strong style={{ color: "#f87171" }}>the most valuable training data</strong> for the AI. Quarantine cases are where the AI learns the most — your detailed analysis directly prevents future quarantines for similar incidents.
        </p>
      </div>

      <div className="esc-cta-row">
        <button className="esc-btn esc-btn-danger" style={{ flex: 1 }} onClick={() => submitHitl("quarantine_review")} disabled={loading}>
          {loading ? <><span className="esc-btn-spinner" /> Saving…</> : <><span>🧠</span> Submit Triage &amp; Update KB</>}
        </button>
        <button className="esc-btn esc-btn-ghost" onClick={onBack} disabled={loading}>← Back</button>
      </div>
    </div>
  );
}

/* ── Done panel ── */
function DonePanel({ result, onClose }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "32px 0 8px" }}>
      <div className="esc-done-ring">
        <span style={{ fontSize: "1.6rem" }}>🧠</span>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#a78bfa", marginBottom: 6 }}>Knowledge Base Updated</div>
        <p style={{ fontSize: "0.7rem", color: "#64748b", lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>
          Your review has been saved. The AI KB has been enriched — future incidents like this will be routed with higher confidence.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, flexDirection: "column", width: "100%", maxWidth: 240 }}>
        <div className="esc-done-chip">
          <span style={{ color: "#64748b", fontSize: "0.58rem", fontFamily: "'JetBrains Mono', monospace" }}>TEAM</span>
          <span style={{ color: "#c4b5fd", fontWeight: 700 }}>{result?.esc_team}</span>
        </div>
        <div className="esc-done-chip">
          <span style={{ color: "#64748b", fontSize: "0.58rem", fontFamily: "'JetBrains Mono', monospace" }}>LEVEL</span>
          <span style={{ color: "#f87171", fontWeight: 700 }}>{result?.esc_level}</span>
        </div>
      </div>
      <button className="esc-btn esc-btn-primary" style={{ width: "100%", maxWidth: 240 }} onClick={onClose}>
        ✓ Close
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN MODAL
══════════════════════════════════════════════════════════════ */
export default function EscalationModal({
  modal, phase, result, error,
  hitlForm, hitlErrors,
  isHighConfidence, isMediumOrLow, isAutoEscalated, isHumanFinalised, isQuarantine,
  enterHitlForm, exitHitlForm, updateHitlField, submitHitl, onClose,
}) {
  const overlayRef = useRef(null);

  // Auto-close after successful submit
  useEffect(() => {
    if (phase === "done") {
      const timer = setTimeout(() => { onClose(); }, 1800);
      return () => clearTimeout(timer);
    }
  }, [phase, onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && phase !== "submitting") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, phase]);

  if (!modal) return null;

  const { issueKey, ticket } = modal;
  const isHitlForm = phase === "hitl_form" || phase === "submitting";
  const isDone     = phase === "done";

  return (
    <>
      <style>{`
        .esc-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 16px;
          animation: escFadeIn 0.18s ease both;
        }
        @keyframes escFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .esc-panel {
          width: 100%; max-width: 540px;
          max-height: 90vh; overflow-y: auto;
          background: linear-gradient(160deg, #13131c 0%, #0f0f14 100%);
          border: 1px solid rgba(139,92,246,0.22);
          border-radius: 20px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.10) inset;
          animation: escSlideUp 0.28s cubic-bezier(0.22,1,0.36,1) both;
          scrollbar-width: thin;
          scrollbar-color: rgba(139,92,246,0.3) transparent;
        }
        @keyframes escSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .esc-header {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 18px;
          background: linear-gradient(90deg, rgba(139,92,246,0.10), rgba(15,15,20,0.4));
          border-bottom: 1px solid rgba(139,92,246,0.12);
          position: sticky; top: 0; z-index: 10;
          border-radius: 20px 20px 0 0;
        }
        .esc-icon-wrap {
          width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 10px;
          background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.25);
          font-size: 1rem; flex-shrink: 0;
        }
        .esc-title {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem; font-weight: 700; color: #e2e8f0; letter-spacing: 0.03em; flex: 1;
        }
        .esc-key-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.62rem; font-weight: 700; color: #fbbf24;
          background: rgba(251,191,36,0.10); border: 1px solid rgba(251,191,36,0.25);
          padding: 2px 9px; border-radius: 999px; letter-spacing: 0.04em;
        }
        .esc-close {
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px; border: none; cursor: pointer;
          background: rgba(255,255,255,0.04); color: #64748b;
          font-size: 0.85rem; transition: background 0.15s, color 0.15s;
        }
        .esc-close:hover { background: rgba(255,255,255,0.09); color: #e2e8f0; }
        .esc-body { padding: 18px; }
        .esc-spinner {
          width: 40px; height: 40px; border-radius: 50%;
          border: 3px solid rgba(139,92,246,0.15);
          border-top-color: #a855f7;
          animation: escSpin 0.75s linear infinite;
        }
        @keyframes escSpin { to { transform: rotate(360deg); } }
        .esc-result-card { display: flex; flex-direction: column; gap: 10px; }
        .esc-stat-box {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(139,92,246,0.10);
          border-radius: 12px; padding: 10px 12px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .esc-stat-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.55rem; color: #475569; text-transform: uppercase; letter-spacing: 0.12em;
        }
        .esc-stat-value { font-size: 0.8rem; font-weight: 600; color: #e2e8f0; }
        .esc-rationale-box {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(139,92,246,0.10);
          border-radius: 12px; padding: 12px;
        }
        .esc-cta-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .esc-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          border-radius: 12px; padding: 9px 16px;
          font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; font-weight: 700;
          letter-spacing: 0.03em; cursor: pointer; border: 1px solid transparent;
          transition: all 0.18s ease; white-space: nowrap;
        }
        .esc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .esc-btn:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.12); }
        .esc-btn:not(:disabled):active { transform: translateY(0) scale(0.98); }
        .esc-btn-primary {
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: #fff; border-color: rgba(124,58,237,0.5);
          box-shadow: 0 4px 16px rgba(124,58,237,0.3);
        }
        .esc-btn-kb {
          flex: 1;
          background: linear-gradient(135deg, rgba(167,139,250,0.2), rgba(124,58,237,0.15));
          color: #c4b5fd; border-color: rgba(167,139,250,0.3);
        }
        .esc-btn-ghost {
          background: rgba(255,255,255,0.04); color: #64748b; border-color: rgba(255,255,255,0.08);
        }
        .esc-btn-ghost:hover { background: rgba(255,255,255,0.08); color: #94a3b8; }
        .esc-btn-danger {
          background: linear-gradient(135deg, rgba(248,113,113,0.22), rgba(239,68,68,0.15));
          color: #fca5a5; border-color: rgba(248,113,113,0.35);
        }
        .esc-btn-spinner {
          display: inline-block; width: 12px; height: 12px; border-radius: 50%;
          border: 2px solid rgba(196,181,253,0.3); border-top-color: #c4b5fd;
          animation: escSpin 0.6s linear infinite;
        }
        .esc-hitl-form { display: flex; flex-direction: column; gap: 14px; }
        .esc-field { display: flex; flex-direction: column; gap: 6px; }
        .esc-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.58rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em;
        }
        .esc-team-chip {
          padding: 7px 10px; border-radius: 10px; cursor: pointer;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          color: #94a3b8;
          font-family: 'JetBrains Mono', monospace; font-size: 0.62rem; font-weight: 600;
          transition: all 0.15s; text-align: left;
        }
        .esc-team-chip:hover:not(:disabled) { background: rgba(139,92,246,0.12); border-color: rgba(139,92,246,0.28); color: #c4b5fd; }
        .esc-team-chip.active { background: rgba(139,92,246,0.18); border-color: rgba(139,92,246,0.45); color: #c4b5fd; box-shadow: 0 0 0 2px rgba(139,92,246,0.15); }
        .esc-level-chip {
          padding: 10px 8px; border-radius: 12px; cursor: pointer;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          color: #94a3b8;
          font-family: 'JetBrains Mono', monospace; font-size: 0.65rem;
          transition: all 0.15s; text-align: center;
          display: flex; flex-direction: column; align-items: center;
        }
        .esc-level-chip:hover:not(:disabled) { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); }
        .esc-textarea {
          width: 100%; resize: vertical;
          background: rgba(10,10,14,0.6); border: 1px solid rgba(139,92,246,0.18);
          border-radius: 12px; padding: 10px 12px;
          color: #e2e8f0; font-family: 'Outfit', sans-serif; font-size: 0.75rem; line-height: 1.6;
          transition: border-color 0.18s, box-shadow 0.18s; outline: none;
          min-height: 80px; box-sizing: border-box;
        }
        .esc-textarea:focus { border-color: rgba(139,92,246,0.45); box-shadow: 0 0 0 3px rgba(139,92,246,0.10); }
        .esc-textarea.has-error { border-color: rgba(248,113,113,0.45); }
        .esc-textarea::placeholder { color: #334155; font-size: 0.7rem; }
        .esc-field-err { font-size: 0.62rem; color: #f87171; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }
        .esc-done-ring {
          width: 64px; height: 64px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(167,139,250,0.12); border: 1px solid rgba(167,139,250,0.25);
          box-shadow: 0 0 30px rgba(167,139,250,0.15);
          animation: escPulse 2s ease-in-out infinite;
        }
        @keyframes escPulse {
          0%,100% { box-shadow: 0 0 30px rgba(167,139,250,0.15); }
          50%      { box-shadow: 0 0 48px rgba(167,139,250,0.3); }
        }
        .esc-done-chip {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 14px; border-radius: 10px;
          background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06);
          font-size: 0.72rem;
        }
        .esc-error-box {
          background: rgba(248,113,113,0.07); border: 1px solid rgba(248,113,113,0.22);
          border-radius: 12px; padding: 16px;
          color: #fca5a5; font-size: 0.72rem; line-height: 1.6; text-align: center;
        }
      `}</style>

      <div
        className="esc-overlay"
        ref={overlayRef}
        onClick={(e) => {
          if (e.target === overlayRef.current && phase !== "submitting") onClose();
        }}
      >
        <div className="esc-panel">

          {/* Header */}
          <div className="esc-header">
            <div className="esc-icon-wrap">🚀</div>
            <span className="esc-title">
              Smart Escalation
              {isHitlForm && !isQuarantine && <span style={{ color: "#facc15", marginLeft: 8 }}>· Human Review</span>}
              {isHitlForm && isQuarantine  && <span style={{ color: "#f87171", marginLeft: 8 }}>· Quarantine Triage</span>}
              {isDone && <span style={{ color: "#4ade80", marginLeft: 8 }}>· Complete</span>}
            </span>
            <span className="esc-key-badge">{issueKey}</span>
            {/* ✕ visible on all pages except: submitting spinner, done (auto-closes) */}
            {phase !== "submitting" && phase !== "done" && (
              <button className="esc-close" onClick={onClose}>✕</button>
            )}
          </div>

          {/* Body */}
          <div className="esc-body">

            {/* Incident summary */}
            {ticket?.summary && phase !== "done" && (
              <div style={{
                marginBottom: 16, padding: "8px 12px",
                background: "rgba(255,255,255,0.02)", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.55rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Incident
                </span>
                <p style={{ margin: "4px 0 0", fontSize: "0.7rem", color: "#94a3b8", lineHeight: 1.55 }}>
                  {ticket.summary.length > 120 ? ticket.summary.slice(0, 120) + "…" : ticket.summary}
                </p>
              </div>
            )}

            {/* Loading */}
            {phase === "loading" && <Spinner />}

            {/* Error */}
            {phase === "error" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="esc-error-box">
                  <div style={{ fontSize: "1.2rem", marginBottom: 6 }}>⚠</div>
                  <strong>Escalation Failed</strong>
                  <p style={{ margin: "6px 0 0", color: "#94a3b8" }}>{error}</p>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="esc-btn esc-btn-ghost" onClick={onClose}>Close</button>
                </div>
              </div>
            )}

            {/* Result */}
            {phase === "result" && result && !isHitlForm && !isDone && (
              <ResultCard
                result={result}
                phase={phase}
                isHighConfidence={isHighConfidence}
                isMediumOrLow={isMediumOrLow}
                isQuarantine={isQuarantine}
                isHumanFinalised={isHumanFinalised}
                enterHitlForm={enterHitlForm}
                onClose={onClose}
              />
            )}

            {/* HITL form — Medium confidence */}
            {isHitlForm && !isQuarantine && (
              <HitlFormMedium
                hitlForm={hitlForm}
                hitlErrors={hitlErrors}
                updateHitlField={updateHitlField}
                submitHitl={submitHitl}
                phase={phase}
                onBack={exitHitlForm}
              />
            )}

            {/* HITL form — Quarantine */}
            {isHitlForm && isQuarantine && (
              <HitlFormQuarantine
                hitlForm={hitlForm}
                hitlErrors={hitlErrors}
                updateHitlField={updateHitlField}
                submitHitl={submitHitl}
                phase={phase}
                onBack={exitHitlForm}
              />
            )}

            {/* Done */}
            {isDone && <DonePanel result={result} onClose={onClose} />}

          </div>
        </div>
      </div>
    </>
  );
}
