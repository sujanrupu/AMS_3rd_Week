// components/SopReminderCard.jsx
import StatusBadge from "./StatusBadge";

export default function SopReminderCard({ ticket, idx = 0, onCreateSop }) {
  const isCompleted = ticket.status === "Completed";
  const jiraUrl = `${import.meta.env.VITE_JIRA_BASE_URL}/browse/${ticket.issue_key}`;

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .src-card {
          animation: slideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
          position: relative;
          background: linear-gradient(145deg, rgba(21,27,43,0.95) 0%, rgba(15,20,32,0.98) 100%);
          border-radius: 20px;
          overflow: visible;
          box-shadow:
            0 4px 24px rgba(0,0,0,0.4),
            0 0 0 1px rgba(0,0,0,0.1) inset;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
        }
        .src-card::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: inherit;
        }
        .src-card.pending {
          border: 1px solid rgba(250,204,21,0.25);
        }
        .src-card.pending::before {
          background: radial-gradient(ellipse at 20% 0%, rgba(250,204,21,0.06) 0%, transparent 60%);
        }
        .src-card.pending:hover {
          border-color: rgba(250,204,21,0.4);
          box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(250,204,21,0.12);
          transform: translateY(-2px);
        }
        .src-card.completed {
          border: 1px solid rgba(34,197,94,0.2);
        }
        .src-card.completed::before {
          background: radial-gradient(ellipse at 20% 0%, rgba(34,197,94,0.06) 0%, transparent 60%);
        }
        .src-card.completed:hover {
          border-color: rgba(34,197,94,0.35);
          box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.1);
          transform: translateY(-2px);
        }
        .src-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid transparent;
          border-radius: 20px 20px 0 0;
          position: relative;
        }
        .src-header::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 1px;
        }
        .src-card.pending .src-header {
          background: linear-gradient(90deg, rgba(250,204,21,0.08) 0%, rgba(15,20,32,0.6) 100%);
          border-bottom-color: rgba(250,204,21,0.12);
        }
        .src-card.pending .src-header::after {
          background: linear-gradient(90deg, rgba(250,204,21,0.35), transparent 60%);
        }
        .src-card.completed .src-header {
          background: linear-gradient(90deg, rgba(34,197,94,0.07) 0%, rgba(15,20,32,0.6) 100%);
          border-bottom-color: rgba(34,197,94,0.12);
        }
        .src-card.completed .src-header::after {
          background: linear-gradient(90deg, rgba(34,197,94,0.3), transparent 60%);
        }
        .src-card.pending .src-divider {
          background: linear-gradient(90deg, rgba(250,204,21,0.15), rgba(250,204,21,0.05) 50%, transparent);
        }
        .src-card.completed .src-divider {
          background: linear-gradient(90deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05) 50%, transparent);
        }
      `}</style>

      <div
        className={`src-card ${isCompleted ? "completed" : "pending"}`}
        style={{ animationDelay: `${idx * 0.05}s` }}
      >
        {/* ── HEADER ── */}
        <div className="src-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>

            {/* Issue key */}
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#fbbf24",
              letterSpacing: "0.04em",
              textShadow: "0 0 12px rgba(251,191,36,0.3)",
            }}>
              {ticket.issue_key}
            </span>

            {/* App | Component */}
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.55rem",
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: "999px",
              background: "rgba(250,204,21,0.08)",
              border: "1px solid rgba(250,204,21,0.18)",
              color: "#fde68a",
            }}>
              {ticket.app_name || "General"} | {ticket.component_name || "General"}
            </span>
          </div>

          {/* ── STATUS BADGE (read-only, always shows Open) ── */}
          <StatusBadge isCompleted={isCompleted} />
        </div>

        {/* ── BODY ── */}
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>

          {/* Summary */}
          <div>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.58rem",
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              display: "block",
              marginBottom: "4px",
            }}>
              Summary
            </span>
            <span style={{ fontSize: "0.72rem", color: "#cbd5e1" }}>
              {ticket.summary}
            </span>
          </div>

          {/* Description */}
          <div>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.58rem",
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              display: "block",
              marginBottom: "4px",
            }}>
              Description
            </span>
            <span style={{ fontSize: "0.72rem", color: "#94a3b8", lineHeight: 1.6 }}>
              {ticket.description}
            </span>
          </div>

          {/* Priority */}
          <div>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.58rem",
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              display: "block",
              marginBottom: "4px",
            }}>
              Priority
            </span>
            <span style={{ fontSize: "0.72rem", color: "#cbd5e1" }}>
              {ticket.priority || "P4"}
            </span>
          </div>

          {/* Parent ref */}
          {ticket.sop_parent_key && (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "8px",
              background: "rgba(139,92,246,0.08)",
              border: "1px solid rgba(139,92,246,0.18)",
              width: "fit-content",
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem", color: "#64748b" }}>
                Parent:
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: "#a78bfa", fontWeight: 700 }}>
                {ticket.sop_parent_key}
              </span>
            </div>
          )}

        </div>

        {/* ── DIVIDER ── */}
        <div className="src-divider" style={{ height: "1px", margin: "0 16px" }} />

        {/* ── ACTIONS ── */}
        <div style={{ padding: "10px 16px 14px", display: "flex", gap: "7px" }}>

          {/* Open in Jira */}
          <button
            onClick={() => window.open(jiraUrl, "_blank")}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              borderRadius: "12px",
              padding: "7px 8px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.6rem",
              fontWeight: 700,
              cursor: "pointer",
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.22)",
              color: "#93c5fd",
              transition: "all 0.18s ease",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(59,130,246,0.1)"}
          >
            🔗 Open in Jira
          </button>

          {/* Create SOP — only shown when pending */}
          {!isCompleted && (
            <button
              onClick={() => onCreateSop(ticket)}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                borderRadius: "12px",
                padding: "7px 8px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.6rem",
                fontWeight: 700,
                cursor: "pointer",
                background: "rgba(139,92,246,0.12)",
                border: "1px solid rgba(139,92,246,0.28)",
                color: "#c4b5fd",
                transition: "all 0.18s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(139,92,246,0.22)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(139,92,246,0.12)"}
            >
              📋 Create SOP
            </button>
          )}
        </div>
      </div>
    </>
  );
}