import { useState } from "react";
import FieldLabel from "./FieldLabel";
import StatusBadge from "./StatusBadge";
import { useEffect } from "react";

export default function TicketCard({
  ticket: t,
  idx = 0,
  onOpenChildren,
  onOpenMerge,
  onStatusChange,
  onOpenRca,
  onRequestComplete,
  onEscalate,
  onOpenPriorityHitl,
  onReassessPrioritySla,
}) {
  const isCompleted = t.status === "Completed";
  const localEsc = localStorage.getItem(`esc_${t.issue_key}`);

  const escTeam = t.esc_team || t.escalated_to || null;
  const escLevel = t.esc_level || null;
  const escAction = t.esc_action || null;
  const escConf = (t.esc_confidence || "").toUpperCase();
  const esc = escTeam || null;
  const escIsAuto = escAction === "AUTO_ROUTED";
  const escIsHuman = escAction === "HUMAN_FINALISED";
  const escIsQuarantine = escAction === "QUARANTINE";
  const escNeedsReview = ["MEDIUM", "LOW"].includes(escConf) && escTeam && !escIsHuman;
  const [expanded, setExpanded] = useState(false);
  const isLongDescription = t.description?.length > 120;
  const highlightKey = localStorage.getItem("highlight_ticket");
  const isHighlighted = highlightKey === t.issue_key;

  useEffect(() => {
    if (isHighlighted) {
      const timer = setTimeout(() => {
        localStorage.removeItem("highlight_ticket");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tc-card {
          animation: slideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
          position: relative;
          background: linear-gradient(145deg, rgba(21,27,43,0.95) 0%, rgba(15,20,32,0.98) 100%);
          border: 1px solid rgba(139,92,246,0.18);
          border-radius: 20px;
          overflow: visible;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(139,92,246,0.12) inset, 0 -1px 0 rgba(0,0,0,0.3) inset;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
          backdrop-filter: blur(20px);
        }
        .tc-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 20% 0%, rgba(139,92,246,0.07) 0%, transparent 60%);
          pointer-events: none;
        }
        .tc-card:hover {
          border-color: rgba(139,92,246,0.38);
          box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.15), 0 1px 0 rgba(139,92,246,0.2) inset;
          transform: translateY(-2px);
        }
        .tc-card.is-completed { border-color: rgba(34,197,94,0.15); }
        .tc-card.is-completed::before { background: radial-gradient(ellipse at 20% 0%, rgba(34,197,94,0.05) 0%, transparent 60%); }
        .tc-card.is-completed:hover { border-color: rgba(34,197,94,0.28); box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.1), 0 1px 0 rgba(34,197,94,0.15) inset; }
        .tc-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: linear-gradient(90deg, rgba(139,92,246,0.08) 0%, rgba(15,20,32,0.6) 100%); border-bottom: 1px solid rgba(139,92,246,0.12); position: relative; }
        .tc-header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, rgba(139,92,246,0.4), transparent 60%); }
        .tc-issue-key { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; font-weight: 700; color: #fbbf24; letter-spacing: 0.04em; text-shadow: 0 0 12px rgba(251,191,36,0.3); }
        .tc-child-badge { font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.25); color: #a78bfa; letter-spacing: 0.03em; }
        .tc-esc-row { padding: 7px 16px; border-bottom: 1px solid rgba(139,92,246,0.08); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .tc-esc-badge { display: inline-flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 0.62rem; font-weight: 600; letter-spacing: 0.03em; padding: 3px 10px; border-radius: 999px; }
        .tc-esc-badge.escalated { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.25); color: #93c5fd; }
        .tc-esc-badge.l1 { background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.2); color: #fbbf24; }
        .tc-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
        .tc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
        .tc-field-value { font-size: 0.72rem; color: #cbd5e1; font-family: inherit; }
        .tc-description { font-size: 0.72rem; color: #94a3b8; line-height: 1.6; }
        .tc-description.clamped { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .tc-show-more { margin-top: 4px; display: block; font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; color: #a78bfa; background: none; border: none; cursor: pointer; padding: 0; letter-spacing: 0.02em; }
        .tc-show-more:hover { text-decoration: underline; color: #c4b5fd; }
        .tc-status-row { display: flex; align-items: center; gap: 10px; padding-top: 4px; }
        .tc-status-label { font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; white-space: nowrap; }
        .tc-select { background: rgba(21,27,43,0.9); border: 1px solid rgba(139,92,246,0.25); color: #e2e8f0; border-radius: 10px; padding: 5px 10px; font-family: 'JetBrains Mono', monospace; font-size: 0.68rem; outline: none; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s; appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b5cf6' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; padding-right: 24px; }
        .tc-select:focus { border-color: rgba(139,92,246,0.5); box-shadow: 0 0 0 3px rgba(139,92,246,0.1); }
        .tc-divider { height: 1px; background: linear-gradient(90deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05) 50%, transparent); margin: 0 16px; }
        .tc-actions { padding: 10px 16px; display: flex; gap: 7px; }
        .tc-actions.row2 { padding-top: 0; padding-bottom: 14px; }
        .tc-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; border-radius: 12px; padding: 7px 8px; font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.03em; cursor: pointer; border: 1px solid transparent; transition: transform 0.18s ease, filter 0.18s ease, background 0.18s ease, box-shadow 0.18s ease; white-space: nowrap; position: relative; overflow: hidden; }
        .tc-btn:hover { transform: translateY(-1px) scale(1.02); filter: brightness(1.15); }
        .tc-btn:active { transform: translateY(0) scale(0.98); filter: brightness(0.95); }
        .tc-btn-resolution { background: rgba(139,92,246,0.12); border-color: rgba(139,92,246,0.28); color: #c4b5fd; box-shadow: 0 2px 8px rgba(139,92,246,0.08); }
        .tc-btn-resolution:hover { background: rgba(139,92,246,0.22); box-shadow: 0 4px 16px rgba(139,92,246,0.2); }
        .tc-btn-rca { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.25); color: #fca5a5; box-shadow: 0 2px 8px rgba(239,68,68,0.06); }
        .tc-btn-rca:hover { background: rgba(239,68,68,0.2); box-shadow: 0 4px 16px rgba(239,68,68,0.18); }
        .tc-btn-child { background: rgba(30,41,59,0.7); border-color: rgba(139,92,246,0.18); color: #94a3b8; }
        .tc-btn-child:hover { background: rgba(51,65,85,0.7); color: #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .tc-btn-merge { background: rgba(251,191,36,0.08); border-color: rgba(251,191,36,0.22); color: #fcd34d; box-shadow: 0 2px 8px rgba(251,191,36,0.05); }
        .tc-btn-merge:hover { background: rgba(251,191,36,0.18); box-shadow: 0 4px 16px rgba(251,191,36,0.15); }
        .tc-btn-jira { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.22); color: #93c5fd; box-shadow: 0 2px 8px rgba(59,130,246,0.06); }
        .tc-btn-jira:hover { background: rgba(59,130,246,0.2); box-shadow: 0 4px 16px rgba(59,130,246,0.18); }
        .tc-btn-escalate { background: linear-gradient(135deg, rgba(124,58,237,0.18), rgba(109,40,217,0.12)); border-color: rgba(124,58,237,0.35); color: #c4b5fd; }
        .tc-btn-escalate:hover { background: linear-gradient(135deg, rgba(124,58,237,0.28), rgba(109,40,217,0.22)); }
        .tc-btn-escalate.already-esc { background: rgba(74,222,128,0.07); border-color: rgba(74,222,128,0.22); color: #4ade80; }
        .tc-btn-escalate.needs-review { background: rgba(250,204,21,0.10); border-color: rgba(250,204,21,0.28); color: #facc15; }
        .tc-card.is-completed .tc-header { background: linear-gradient(90deg, rgba(34,197,94,0.06) 0%, rgba(15,20,32,0.6) 100%); }
        .tc-card.is-completed .tc-header::after { background: linear-gradient(90deg, rgba(34,197,94,0.3), transparent 60%); }
        .tc-app-badge { font-family: 'JetBrains Mono', monospace; font-size: 0.55rem; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: rgba(59,130,246,0.10); border: 1px solid rgba(59,130,246,0.25); color: #93c5fd; white-space: normal; cursor: default; }
        .tc-highlight { outline: 2px solid #facc15; box-shadow: 0 0 0 4px rgba(250, 204, 21, 0.25); transform: scale(1.02); transition: all 0.3s ease; }
      `}</style>

      <div
        id={`ticket-${t.issue_key}`}
        className={`tc-card${isCompleted ? " is-completed" : ""}${isHighlighted ? " tc-highlight" : ""}`}
        style={{ animationDelay: `${idx * 0.05}s` }}
      >
        {/* ── HEADER ── */}
        <div className="tc-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="tc-issue-key">{t.issue_key || "-"}</span>
            {t.child_count > 0 && (
              <span className="tc-child-badge">{t.child_count} child</span>
            )}
            <span className="tc-app-badge" data-full={`${t.app_name || "General"} | ${t.component_name || "General"}`}>
              {(t.app_name || "General")} | {(t.component_name || "General")}
            </span>
          </div>
          <StatusBadge isCompleted={isCompleted} />
        </div>

        {/* ── ESCALATION ROW ── */}
        {!isCompleted && (
          <div
            className="tc-esc-row"
            style={{
              background: esc
                ? escIsAuto ? "rgba(74,222,128,0.04)"
                  : escIsHuman ? "rgba(167,139,250,0.04)"
                    : escIsQuarantine ? "rgba(248,113,113,0.04)"
                      : "rgba(59,130,246,0.04)"
                : "rgba(15,20,32,0.4)",
            }}
          >
            {esc ? (
              <>
                {escIsAuto && <span className="tc-esc-badge" style={{ background: "rgba(74,222,128,0.10)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80" }}>✦ Auto-Escalated</span>}
                {escIsHuman && <span className="tc-esc-badge" style={{ background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.28)", color: "#c4b5fd" }}>✔ Human Finalised</span>}
                {escIsQuarantine && <span className="tc-esc-badge" style={{ background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.28)", color: "#f87171" }}>⚠ Quarantine</span>}
                {!escIsAuto && !escIsHuman && !escIsQuarantine && <span className="tc-esc-badge escalated">🚀 Escalated</span>}
                {escTeam && (
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", color: "#94a3b8" }}>
                    → <strong style={{ color: "#c4b5fd" }}>{escTeam}</strong>
                    {escLevel && <span style={{ marginLeft: 4, color: escLevel === "L3" ? "#f87171" : escLevel === "L2" ? "#60a5fa" : "#facc15", fontWeight: 700 }}> {escLevel}</span>}
                  </span>
                )}
                {escNeedsReview && (
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", color: "#facc15", background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", padding: "2px 8px", borderRadius: 999 }}>◆ Review Needed</span>
                )}
              </>
            ) : (
              <span className="tc-esc-badge l1">● Assigned at L1 — Not Escalated</span>
            )}
          </div>
        )}

        {/* ── BODY ── */}
        <div className="tc-body">
          {t.priority && (
            <div className="tc-grid-2" style={{ marginBottom: "4px" }}>
              <FieldLabel label="Priority">
                <span className="tc-field-value" style={{
                  color: t.priority === "P1" ? "#f87171" : t.priority === "P2" ? "#fb923c" : t.priority === "P3" ? "#facc15" : "#4ade80",
                  fontWeight: "bold",
                  background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px"
                }}>{t.priority}</span>
              </FieldLabel>
              <FieldLabel label="SLA">
                <span className="tc-field-value">{t.sla_response_time || "-"} / {t.sla_resolution_time || "-"}</span>
              </FieldLabel>
            </div>
          )}
          <div className="tc-grid-2">
            <FieldLabel label="Name">
              <span className="tc-field-value">{t.name || "-"}</span>
            </FieldLabel>
            <FieldLabel label="Email">
              <span className="tc-field-value" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.email || "-"}
              </span>
            </FieldLabel>
          </div>
          <FieldLabel label="Summary">
            <span className="tc-field-value">{t.summary || "-"}</span>
          </FieldLabel>
          <FieldLabel label="Description">
            <div>
              <span className={`tc-description${!expanded ? " clamped" : ""}`}>
                {t.description || "-"}
              </span>
              {isLongDescription && (
                <button className="tc-show-more" onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Show less ▲" : "Show more ▼"}
                </button>
              )}
            </div>
          </FieldLabel>
          {!isCompleted && (
            <div className="tc-status-row">
              <span className="tc-status-label">Update Status</span>
              <select
                className="tc-select"
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "Completed") { onRequestComplete(t.issue_key); return; }
                  onStatusChange(t.issue_key, value);
                }}
              >
                <option value="Open">Open</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          )}
        </div>

        {/* ── ACTIONS ROW 1 ── */}
        <div className="tc-divider" />
        <div className="tc-actions">
          <button className="tc-btn tc-btn-resolution" onClick={() => window.open(`/sops?id=${t.issue_key}`, "_blank")}>
            📋 Resolution Steps
          </button>
          <button className="tc-btn tc-btn-rca" onClick={() => onOpenRca(t.issue_key)}>
            🔍 RCA
          </button>
          <button className="tc-btn tc-btn-child" onClick={() => onOpenChildren(t.issue_key)}>
            👥 Child
          </button>
          <button
            className="tc-btn tc-btn-merge"

            onClick={() => {

              // block child ticket merge
              if (t.parent_ticket_key) {

                alert(
                  "Merge allowed only from parent tickets"
                );

                return;
              }

              onOpenMerge({
                issue_key: t.issue_key,
                summary: t.summary,
                status: t.status,
                child_count: t.child_count || 0
              });

            }}
          >
            🔀 Merge
          </button>
        </div>

        {/* ── ACTIONS ROW 2 ── */}
        <div className="tc-actions row2">
          {t.priority && ['P1', 'P2'].includes(t.priority) && t.hitl_reviewed !== true && !isCompleted && (
            <button
              className="tc-btn"
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5",
                boxShadow: "0 2px 8px rgba(239,68,68,0.1)"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.25)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; }}
              onClick={() => onOpenPriorityHitl && onOpenPriorityHitl(t)}
            >
              ⚠ Review Priority_HITL
            </button>
          )}
          {onReassessPrioritySla && !isCompleted && impactValue !== "-" && urgencyValue !== "-" && (
            <button
              className="tc-btn"
              style={{
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.3)",
                color: "#93c5fd",
                boxShadow: "0 2px 8px rgba(59,130,246,0.08)"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.18)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.12)"; }}
              onClick={() => onReassessPrioritySla && onReassessPrioritySla({
                issue_key: t.issue_key,
                summary: t.summary,
                description: t.description || "",
                app_name: t.app_name || "",
                component_name: t.component_name || "",
                impact: impactValue,
                urgency: urgencyValue,
              })}
            >
              🔁 Re-assess SLA
            </button>
          )}
          <button
            className="tc-btn tc-btn-jira"
            onClick={() => window.open(`${import.meta.env.VITE_JIRA_BASE_URL}/browse/${t.issue_key}`, "_blank")}
          >
            🔗 Open in Jira
          </button>
          {!isCompleted && (
            <button
              className={`tc-btn tc-btn-escalate${escIsAuto || escIsHuman ? " already-esc" : escNeedsReview ? " needs-review" : ""}`}
              onClick={() => onEscalate && onEscalate(t.issue_key, t)}
            >
              {escIsAuto ? "✦ Auto-Escalated" : escIsHuman ? "✔ Reviewed" : escIsQuarantine ? "⚠ Quarantine" : escNeedsReview ? "◆ Review Escalation" : escTeam ? "🚀 View Escalation" : "🚀 Escalate"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
