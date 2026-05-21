import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSop } from "../hooks/useSop";
import StatusBar from "../components/StatusBar";
import ProgressBar from "../components/ProgressBar";
import SopSection from "../components/SopSection";
import ChecklistItem from "../components/ChecklistItem";
import { apiRequest } from "../api/apiClient";
import ConfirmCompleteModal from "../components/ConfirmCompleteModal";


// ─────────────────────────────────────────────
// NO SOP FOUND BANNER
// ─────────────────────────────────────────────
function NoSopBanner() {
  return (
    <div className="border border-yellow/20 rounded-2xl overflow-hidden mb-6 animate-slideUp" style={{ background: "rgba(250,204,21,.04)" }}>
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-yellow/15" style={{ background: "rgba(250,204,21,.06)" }}>
        <div className="w-7 h-7 flex items-center justify-center border border-yellow/20 rounded-lg" style={{ background: "rgba(250,204,21,.15)" }}>⚠️</div>
        <span className="font-bold text-yellow text-sm flex-1">No SOP Found</span>
        <span className="font-mono text-[0.7rem] text-yellow border border-yellow/20 px-3 py-0.5 rounded-full" style={{ background: "rgba(250,204,21,.08)" }}>Manual Review Required</span>
      </div>
      <div className="px-5 py-4">
        <p className="text-[0.825rem] text-slate-400 leading-relaxed">
          No SOP matched this incident in the knowledge base. Please escalate for manual triage or contact your team lead.
        </p>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// SOP INFO PANEL
// ─────────────────────────────────────────────
function SopInfoPanel({ data }) {
  if (data.sop_match_type === "no_sop_found" || !data.sop_match_type) return null;
  return (
    <div className="bg-surface border border-purple/15 rounded-2xl overflow-hidden mb-6 animate-slideUp">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-surface2 border-b border-purple/15">
        <div className="w-7 h-7 flex items-center justify-center bg-purple/25 border border-purple/15 rounded-lg">📋</div>
        <span className="font-bold text-purple text-sm flex-1">Matched SOP</span>
        <span className="font-mono text-[0.7rem] text-green bg-green/5 border border-green/20 px-3 py-0.5 rounded-full">✔ SOP Match</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-purple/10">
        <div className="px-5 py-4">
          <span className="font-mono text-[0.6rem] text-muted uppercase tracking-widest block mb-1">SOP Code</span>
          <span className="font-bold text-slate-200">{data.sop_code || "—"}</span>
        </div>
        <div className="px-5 py-4">
          <span className="font-mono text-[0.6rem] text-muted uppercase tracking-widest block mb-1">Title</span>
          <span className="font-bold text-slate-200">{data.sop_title || "—"}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-purple/10 border-t border-purple/10">
        <div className="px-5 py-4">
          <span className="font-mono text-[0.6rem] text-muted uppercase tracking-widest block mb-1">App</span>
          <span className="font-bold text-slate-200">{data.app_code || "—"}</span>
        </div>
        <div className="px-5 py-4">
          <span className="font-mono text-[0.6rem] text-muted uppercase tracking-widest block mb-1">Component</span>
          <span className="font-bold text-slate-200">{data.component_code || "—"}</span>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// RESOLUTION PROMPT
// ─────────────────────────────────────────────
function ResolutionPrompt({ onResolved }) {
  return (
    <div className="bg-surface border border-purple/30 rounded-2xl mt-4">
      <div className="p-6 text-center">
        <p className="text-[0.95rem] font-bold text-slate-200 mb-2">
          Did these SOP resolution steps resolve your issue?
        </p>
        <p className="text-[0.8rem] text-muted mb-5">
          Let us know so we can keep the SOP library updated.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => onResolved(true)}
            className="bg-green/10 border border-green/30 text-green text-sm font-bold px-6 py-2.5 rounded-xl cursor-pointer hover:bg-green/20 transition-all"
          >
            ✔ Yes — Issue Resolved
          </button>
          <button
            onClick={() => onResolved(false)}
            className="bg-red/10 border border-red/20 text-red text-sm font-bold px-6 py-2.5 rounded-xl cursor-pointer hover:bg-red/20 transition-all"
          >
            ✖ Issue Not Resolved
          </button>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// NO SOP ESCALATE PROMPT
// ─────────────────────────────────────────────
function NoSopEscalatePrompt({ onEscalate, issueKey }) {
  const [clicked, setClicked] = React.useState(false);
  return (
    <div className="bg-surface border border-yellow/20 rounded-2xl mt-4">
      <div className="p-6 text-center">
        <p className="text-[0.95rem] font-bold text-slate-200 mb-2">
          No SOP matched — manual escalation required
        </p>
        <p className="text-[0.8rem] text-muted mb-5">
          This incident has no automated resolution steps. Escalate to your team for manual triage.
        </p>
        {!clicked ? (
          <button
            onClick={() => { onEscalate(); setClicked(true); }}
            className="bg-red/10 border border-red/20 text-red text-sm font-bold px-6 py-2.5 rounded-xl cursor-pointer hover:bg-red/20 transition-all"
          >
            ✖ Issue Not Resolved
          </button>
        ) : (
          <div
            style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 16, padding: "20px 16px" }}
          >
            <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>⚠</div>
            <p style={{ fontWeight: 700, color: "#f87171", fontSize: "0.85rem", marginBottom: 8 }}>
              Issue Not Resolved
            </p>
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.6, marginBottom: 16 }}>
              To escalate this ticket to the correct team and level, go back to the Dashboard
              and click the <strong style={{ color: "#c4b5fd" }}>🚀 Escalate</strong> button
              on ticket <strong style={{ color: "#facc15" }}>{issueKey}</strong>.
            </p>
            <a
              href="/tickets"
              onClick={() => localStorage.setItem("highlight_ticket", issueKey)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.35)",
                color: "#c4b5fd", fontSize: "0.72rem", fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                padding: "10px 20px", borderRadius: 12, cursor: "pointer",
                textDecoration: "none", letterSpacing: "0.03em",
              }}
            >
              ← Go to Dashboard — Escalate {issueKey}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// MAIN SOP EXECUTION PAGE
// ─────────────────────────────────────────────
export default function Sops() {
  const [searchParams] = useSearchParams();
  const issueKey = searchParams.get("id") || "UNKNOWN";

  const {
    status, data, loading, error,
    checkedItems, toggleCheck, selectAll, getProgress,
    fetchSop, completeTicket, escalateTicket, checkBeforeResolve,
    escResult,
  } = useSop(issueKey);

  const [resolved,          setResolved]          = useState(null);
  const [completedBanner,   setCompletedBanner]    = useState(false);
  const [escalationDisplay, setEscalationDisplay]  = useState(null);
  const [priorEscalation,   setPriorEscalation]    = useState(null);
  const [confirmModal,      setConfirmModal]        = useState(null);

  useEffect(() => { fetchSop(); }, [fetchSop]);



  useEffect(() => {
    if (issueKey !== "UNKNOWN" && issueKey.includes(".")) {
      window.location.replace(`/sops?id=${issueKey.split(".")[0]}`);
    }
  }, [issueKey]);

  useEffect(() => {
    if (issueKey && issueKey !== "UNKNOWN") {
      const stored = localStorage.getItem(`esc_${issueKey}`);
      if (stored) setPriorEscalation(stored);
    }
  }, [issueKey]);

  const noSopFound  = data?.sop_match_type === "no_sop_found";
  const paired      = data?.paired_steps || [];
  const progress    = getProgress(paired.length);
  const isCompleted = data?.ticket_status === "Completed";
  // Pull escalation data from useSop hook
  const escTeam    = escResult?.esc_team   || null;
  const escLevel   = escResult?.esc_level  || null;
  const escAction  = escResult?.esc_action || null;
  const isEscalated = !!(escTeam);
  const isReadOnly  = isCompleted || isEscalated;

  // Auto-tick all checklist items when escalated
  useEffect(() => {
    if (isEscalated && data?.paired_steps?.length > 0) {
      selectAll([]); selectAll(data.paired_steps);
    }
  }, [isEscalated, data]);

  async function handleResolved(success) {
    setResolved(success);
    if (success) {
      const check = await checkBeforeResolve(issueKey);
      if (!check.allowed) {
        setConfirmModal({
          issueKey,
          openChildren: check.openChildren,
          mode: "sop_complete",
        });
        return;
      }
      const completeRes = await completeTicket();
      if (!completeRes?.error) setCompletedBanner(true);
    } else {
      const escalateRes = await escalateTicket();
      if (escalateRes && !escalateRes.error) {
        const channel = escalateRes.channel || escalateRes.team || "";
        localStorage.setItem(`esc_${issueKey}`, channel);
      }
      setEscalationDisplay(
        escalateRes?.channel || escalateRes?.team || "No Channel"
      );
    }
  }

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-6 py-8 pb-16">

      {/* HEADER */}
      <div className="flex items-center justify-center mb-10 pb-6 border-b border-purple/15">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-purple tracking-tight">📋 SOP Execution</h1>
          <span
            className="font-mono inline-block mt-1 text-xs px-3 py-0.5 rounded-full border"
            style={
              completedBanner || isCompleted
                ? { color: "#4ade80", background: "rgba(74,222,128,.15)", border: "1px solid rgba(74,222,128,.2)" }
                : priorEscalation
                  ? { color: "#f87171", background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.2)" }
                  : { color: "#facc15", background: "rgba(168,85,247,.25)", border: "1px solid rgba(168,85,247,.15)" }
            }
          >
            {issueKey}
            {(completedBanner || isCompleted) && " · Completed"}
            {isEscalated && !isCompleted && " · Escalated"}
          </span>
        </div>
      </div>

      {/* ALREADY RESOLVED BANNER */}
      {isCompleted && (
        <div
          className="flex items-center gap-4 border rounded-2xl px-5 py-4 mb-6 animate-slideUp"
          style={{ background: "rgba(74,222,128,.06)", borderColor: "rgba(74,222,128,.25)" }}
        >
          <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl text-lg"
            style={{ background: "rgba(74,222,128,.12)", border: "1px solid rgba(74,222,128,.3)" }}>
            ✅
          </div>
          <div className="flex-1">
            <p className="font-bold text-green text-sm">This ticket is already resolved</p>
            <p className="font-mono text-[0.72rem] text-muted mt-0.5">Resolution steps shown below are for reference only.</p>
          </div>
          <span className="font-mono text-[0.65rem] text-green border border-green/20 bg-green/5 px-2.5 py-1 rounded-full flex-shrink-0">
            Read-only
          </span>
        </div>
      )}

      {/* ALREADY ESCALATED BANNER */}
      {isEscalated && !isCompleted && (
        <div
          className="flex items-center gap-4 border rounded-2xl px-5 py-4 mb-6 animate-slideUp"
          style={{ background: "rgba(248,113,113,.06)", borderColor: "rgba(248,113,113,.25)" }}
        >
          <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl text-lg"
            style={{ background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)" }}>
            🚨
          </div>
          <div className="flex-1">
            <p className="font-bold text-red text-sm mb-1">
              This ticket has already been escalated
            </p>
            {escTeam && escLevel && (
              <p className="font-mono text-[0.68rem] mt-0.5" style={{ color: "#94a3b8" }}>
                Routed to{" "}
                <strong style={{ color: "#c4b5fd" }}>{escTeam}</strong>
                {" "}at{" "}
                <strong style={{ color: escLevel === "L3" ? "#f87171" : escLevel === "L2" ? "#60a5fa" : "#facc15" }}>
                  {escLevel}
                </strong>
                {escAction === "AUTO_ROUTED" && (
                  <span style={{ marginLeft: 8, color: "#4ade80", fontSize: "0.6rem" }}>✦ Auto-Escalated</span>
                )}
                {escAction === "HUMAN_FINALISED" && (
                  <span style={{ marginLeft: 8, color: "#a78bfa", fontSize: "0.6rem" }}>✔ Human Reviewed</span>
                )}
                {escAction === "QUARANTINE" && (
                  <span style={{ marginLeft: 8, color: "#f87171", fontSize: "0.6rem" }}>⚠ Quarantine</span>
                )}
              </p>
            )}
            <p className="font-mono text-[0.65rem] text-muted mt-1">
              Resolution steps are shown for reference only. No further action needed here.
            </p>
          </div>
          <span className="font-mono text-[0.62rem] text-red border border-red/20 bg-red/5 px-2.5 py-1 rounded-full flex-shrink-0">
            Escalated
          </span>
        </div>
      )}

      {/* COMPLETED BANNER — shown after resolving in current session */}
      {completedBanner && !isCompleted && (
        <div className="flex items-center gap-3 border border-green/25 rounded-xl px-5 py-3 mb-6 animate-slideUp" style={{ background: "rgba(74,222,128,.06)" }}>
          <span>✅</span>
          <span className="font-bold text-green text-sm">Ticket {issueKey} marked as Completed</span>
        </div>
      )}

      {/* NO SOP BANNER or SOP INFO PANEL */}
      {data && noSopFound  && <NoSopBanner />}
      {data && !noSopFound && <SopInfoPanel data={data} />}

      {/* STATUS BAR */}
      {!noSopFound && !isReadOnly && (
        <StatusBar state={status.state} text={status.text} time={status.time} />
      )}

      {/* PROGRESS BAR */}
      {!isReadOnly && <ProgressBar pct={progress} />}

      {/* SKELETON */}
      {loading && (
        <div className="bg-surface border border-purple/15 rounded-2xl p-5 mb-6">
          <div className="h-3.5 rounded-lg bg-surface2 w-2/5 mb-3 animate-pulse" />
          <div className="h-3.5 rounded-lg bg-surface2 w-full mb-2 animate-pulse" />
          <div className="h-3.5 rounded-lg bg-surface2 w-4/5 animate-pulse" />
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="font-mono text-center py-12 text-muted text-sm">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-red font-semibold">Failed to load SOP</div>
          <div className="mt-2">{error}</div>
        </div>
      )}

      {/* CONTENT */}
      {!loading && !error && data && (
        <>
          {paired.length > 0 ? (
            <SopSection
              icon="✅"
              title="Resolution Steps"
              count={`${paired.length} items`}
              delay={0.05}
              rightSlot={
                !isReadOnly && (
                  <button
                    onClick={() => selectAll(paired)}
                    className="font-mono text-[0.7rem] text-purple bg-purple/10 border border-purple/20 rounded-md px-3 py-1 cursor-pointer hover:bg-purple/20 transition-all"
                  >
                    {checkedItems.size === paired.length ? "✓ Deselect All" : "☐ Select All"}
                  </button>
                )
              }
            >
              <div className="flex flex-col gap-2">
                {paired.map((item, i) => (
                  isReadOnly ? (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-4 py-3 bg-surface2 rounded-xl"
                      style={{
                        border: isCompleted
                          ? "1px solid rgba(74,222,128,.1)"
                          : "1px solid transparent",
                      }}
                    >
                      <div
                        className="w-[18px] h-[18px] min-w-[18px] rounded-md flex items-center justify-center mt-0.5 flex-shrink-0"
                        style={isCompleted
                          ? { background: "rgba(74,222,128,.15)", border: "1px solid rgba(74,222,128,.3)" }
                          : isEscalated
                            ? { background: "rgba(248,113,113,.15)", border: "1px solid rgba(248,113,113,.3)" }
                            : { background: "rgba(100,116,139,.1)", border: "1px solid rgba(100,116,139,.2)", borderRadius: "50%" }
                        }
                      >
                        {isCompleted
                          ? <span style={{ color: "#4ade80", fontSize: "11px", fontWeight: 900 }}>✓</span>
                          : isEscalated
                            ? <span style={{ color: "#f87171", fontSize: "11px", fontWeight: 900 }}>✓</span>
                            : <span className="font-mono text-[0.55rem] text-muted">{i + 1}</span>
                        }
                      </div>
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="text-sm leading-relaxed text-slate-300">
                          {typeof item === "string"
                            ? item
                            : (item.label || item.step || item.title || "No step")}
                        </div>
                        {typeof item !== "string" && (item.command || item.cmd) && (
                          <div
                            className="font-mono text-[0.72rem] px-3 py-2 rounded-lg overflow-x-auto"
                            style={{
                              background: "rgba(0,0,0,0.35)",
                              border: "1px solid rgba(168,85,247,.12)",
                              color: "#c084fc",
                            }}
                          >
                            {item.command || item.cmd}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <ChecklistItem
                      key={i}
                      item={item}
                      index={i}
                      checked={checkedItems.has(i)}
                      onToggle={toggleCheck}
                    />
                  )
                ))}
              </div>
            </SopSection>
          ) : (
            !noSopFound && (
              <div className="font-mono text-center py-12 text-muted text-sm">
                <div className="text-4xl mb-4">📭</div>
                <div>No resolution steps available for this ticket.</div>
              </div>
            )
          )}

          {/* NO SOP — ESCALATE PROMPT */}
          {!isReadOnly && noSopFound && resolved === null && (
            <NoSopEscalatePrompt onEscalate={() => handleResolved(false)} issueKey={issueKey} />
          )}

          {/* RESOLUTION PROMPT — only when SOP matched and all steps checked */}
          {!isReadOnly && !noSopFound && progress === 100 && resolved === null && (
            <ResolutionPrompt onResolved={handleResolved} />
          )}

          {/* YES — resolved */}
          {resolved === true && (
            <div className="bg-surface border border-purple/15 rounded-2xl p-6 text-center mt-4 animate-slideUp">
              <div className="text-3xl mb-3">✅</div>
              <p className="font-bold text-green text-sm">Issue Resolved</p>
              <p className="text-muted text-xs mt-1 leading-relaxed">Great work! The ticket has been marked as completed.</p>
            </div>
          )}

          {/* NO — issue not resolved */}
          {resolved === false && (
            <div
              className="rounded-2xl p-6 text-center mt-4 animate-slideUp"
              style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.2)" }}
            >
              <div className="text-3xl mb-3">⚠</div>
              <p className="font-bold text-red text-sm mb-3">Issue Not Resolved</p>
              <p className="text-[0.78rem] text-slate-400 leading-relaxed mb-5">
                To escalate this ticket to the correct team and level, go back to the Dashboard
                and click the <strong style={{ color: "#c4b5fd" }}>🚀 Escalate</strong> button on ticket <strong style={{ color: "#facc15" }}>{issueKey}</strong>.
              </p>
              <a
                href="/tickets"
                onClick={() => {
                  localStorage.setItem("highlight_ticket", issueKey);
                }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.35)",
                  color: "#c4b5fd", fontSize: "0.75rem", fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: "10px 20px", borderRadius: 12, cursor: "pointer",
                  textDecoration: "none", letterSpacing: "0.03em",
                  transition: "all 0.18s ease",
                }}
              >
                ← Go to Dashboard & Escalate {issueKey}
              </a>
            </div>
          )}
        </>
      )}

      {/* CONFIRM COMPLETE MODAL */}
      {confirmModal && (
        <ConfirmCompleteModal
          open={!!confirmModal}
          issueKey={confirmModal.issueKey}
          openChildren={confirmModal.openChildren}
          mode="sop_complete"
          onCancel={() => setConfirmModal(null)}
          onConfirm={async () => {
            setConfirmModal(null);
            const res = await apiRequest(
              `/tickets/${issueKey}/complete?force=true`,
              "PUT"
            );
            if (!res?.error) {
              setCompletedBanner(true);
              setResolved(true);
            }
          }}
        />
      )}

    </div>
  );
}