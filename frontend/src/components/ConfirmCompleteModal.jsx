import { useEffect, useState } from "react";
import { apiRequest } from "../api/apiClient";
import CreateSopModal from "./CreateSopModal";

export default function ConfirmCompleteModal({
  open,
  issueKey,
  ticket,
  openChildren = [],
  skipToSopPrompt = false,   // true when ticket had no children — skip straight to sop_prompt
  onCancel,
  onConfirm,                 // async fn — should complete the ticket, return { ok } or { error }
  onDone,                    // called when the entire flow is finished (sop created or skipped)
}) {
  const [step,    setStep]    = useState("confirm");
  const [loading, setLoading] = useState(false);

  // reset step whenever modal opens, respect skipToSopPrompt
  useEffect(() => {
    if (!open) return;
    setStep(skipToSopPrompt ? "sop_prompt" : "confirm");
  }, [open, skipToSopPrompt]);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  if (!open) return null;

  // ── STEP: CONFIRM (children warning) ──
  async function handleConfirm() {
    setLoading(true);
    // FIX: onConfirm completes the ticket but does NOT close the modal
    const result = await onConfirm();
    setLoading(false);

    if (result?.error) return; // stay on confirm step if something failed

    // ticket is now completed — check if SOP exists
    const hasNoSop = !ticket?.sop_match_type || ticket?.sop_match_type === "no_sop_found";
    if (hasNoSop) {
      setStep("sop_prompt");  // modal stays open, advances to next step
    } else {
      onDone();               // SOP exists, nothing more to do
    }
  }

  // ── STEP: I'll do it later → create P4 Jira reminder ──
  async function handleDoLater() {
    setLoading(true);
    try {
      await apiRequest(`/tickets/${issueKey}/create-sop-reminder`, "POST", {});
    } catch {
      // fail silently — ticket is already completed
    }
    setLoading(false);
    onDone();
  }

  // ── STEP: SOP PROMPT ──
  if (step === "sop_prompt") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-[420px] bg-[#151b2b] border border-yellow-500/20 rounded-2xl shadow-2xl overflow-hidden">

          <div className="px-5 py-4 border-b border-yellow-500/15 bg-[#1c2338]">
            <h2 className="text-sm font-bold text-yellow-400 font-mono">📋 No SOP Found</h2>
            <p className="text-[0.65rem] text-slate-400 font-mono mt-1">Ticket: {issueKey}</p>
          </div>

          <div className="px-5 py-5">
            <p className="text-sm text-slate-300 leading-relaxed mb-2">
              No SOP was matched for this issue.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Would you like to create one for future reference? This will be pushed to Confluence
              and added to the knowledge base so similar issues are resolved faster.
            </p>
          </div>

          <div className="flex gap-3 px-5 py-4 border-t border-yellow-500/15 bg-[#1c2338]">
            <button
              onClick={handleDoLater}
              disabled={loading}
              className="flex-1 bg-[#151b2b] hover:bg-white/5 border border-slate-600/30 text-slate-400 text-xs font-mono py-2.5 rounded-xl transition disabled:opacity-50"
            >
              {loading ? "Creating ticket..." : "🕐 I'll do this later"}
            </button>
            <button
              onClick={() => setStep("create_sop")}
              disabled={loading}
              className="flex-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 text-purple-300 text-xs font-mono py-2.5 rounded-xl transition"
            >
              ✅ Yes — Create SOP
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: CREATE SOP FORM ──
  if (step === "create_sop") {
    return (
      <CreateSopModal
        open={true}
        issueKey={issueKey}
        ticket={ticket}
        onCancel={() => setStep("sop_prompt")}
        onDone={() => onDone()}
      />
    );
  }

  // ── STEP: CONFIRM (default) ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[420px] bg-[#151b2b] border border-purple-500/20 rounded-2xl shadow-2xl overflow-hidden">

        <div className="px-4 py-3 border-b border-purple-500/15 bg-[#1c2338]">
          <h2 className="text-sm font-bold text-purple-400 font-mono">⚠ Confirm Completion</h2>
          <p className="text-[0.65rem] text-slate-400 font-mono mt-1">Ticket: {issueKey}</p>
        </div>

        <div className="px-4 py-3 space-y-3">
          <p className="text-xs text-slate-300">
            Some child tickets are still <b>open</b>.
            Completing this parent will mark all child tickets as <b>Completed</b>.
          </p>

          <div className="bg-[#1c2338] border border-purple-500/10 rounded-lg p-2 max-h-32 overflow-y-auto">
            {openChildren.length > 0 ? (
              openChildren.map((child) => (
                <div key={child} className="text-[0.65rem] text-yellow-400 font-mono py-1 border-b border-purple-500/10 last:border-none">
                  🔹 {child}
                </div>
              ))
            ) : (
              <p className="text-[0.65rem] text-slate-400">No open children</p>
            )}
          </div>

          <p className="text-[0.65rem] text-red-400 font-mono">⚠ This action cannot be undone</p>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-purple-500/15 bg-[#1c2338]">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 bg-[#151b2b] hover:bg-white/5 border border-purple-500/20 text-slate-300 text-xs font-mono py-2 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-300 text-xs font-mono py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Completing..." : "Confirm Complete"}
          </button>
        </div>
      </div>
    </div>
  );
}