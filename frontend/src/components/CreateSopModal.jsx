import { useState } from "react";
import { apiRequest } from "../api/apiClient";

export default function CreateSopModal({ open, issueKey, ticket, onDone, onCancel }) {
  const [form, setForm] = useState({
    sop_code:         "",
    title:            "",
    keywords:         "",
    symptoms:         "",
    resolution_steps: "",
    component_code:   ticket?.component_code || "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.id]: e.target.value }));
  }

  async function handleSubmit() {
    if (!form.sop_code || !form.title || !form.keywords || !form.symptoms || !form.resolution_steps) {
      setError("All fields are required.");
      return;
    }
    if (!form.component_code) {
      setError("Component Code is required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest(`/tickets/${issueKey}/create-sop`, "POST", form);
      if (res?.ok) {
        setSuccess(true);
        setTimeout(() => onDone({ type: "created", sop_code: res.sop_code }), 1800);
      } else {
        setError(res?.detail || res?.message || "Failed to create SOP.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full px-3 py-2.5 bg-[#0a0e1a] border border-slate-700/40 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 text-sm transition-all";
  const labelCls = "block text-[0.6rem] font-bold text-slate-500 uppercase tracking-widest mb-1.5";

  // ── SUCCESS STATE ──
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-[420px] bg-[#151b2b] border border-green-500/25 rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-4 animate-fadeIn">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            ✅
          </div>
          <div className="text-center">
            <p className="font-bold text-green-400 text-sm">SOP Created Successfully</p>
            <p className="text-slate-500 text-[0.7rem] font-mono mt-1">
              {form.sop_code} · pushed to Confluence &amp; indexed
            </p>
          </div>
          <div className="flex gap-1 mt-1">
            {[0,1,2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-green-500/60"
                style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div className="w-[560px] max-h-[92vh] overflow-y-auto bg-[#151b2b] border border-purple-500/20 rounded-2xl shadow-2xl flex flex-col">

        {/* ── HEADER ── */}
        <div className="flex items-center gap-3 px-6 py-4 bg-[#1c2338] border-b border-purple-500/15 rounded-t-2xl sticky top-0 z-10">
          <div
            className="w-8 h-8 flex items-center justify-center rounded-xl text-base flex-shrink-0"
            style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)" }}
          >
            📋
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-purple-400 font-mono">Create New SOP</p>
            <p className="text-[0.6rem] text-slate-500 font-mono mt-0.5">
              Pushed to Confluence · embedded into knowledge base
            </p>
          </div>
          <button
            onClick={() => !loading && onCancel()}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all text-sm flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* ── CONTEXT STRIP ── */}
        <div
          className="flex items-center gap-3 px-6 py-2.5 border-b border-purple-500/10"
          style={{ background: "rgba(139,92,246,0.04)" }}
        >
          <span className="font-mono text-[0.6rem] text-slate-600 uppercase tracking-widest">Ticket</span>
          <span className="font-mono text-[0.65rem] font-bold text-purple-400">{issueKey}</span>
          {ticket?.app_name && (
            <>
              <span className="text-slate-700">·</span>
              <span className="font-mono text-[0.6rem] text-slate-500">{ticket.app_name}</span>
            </>
          )}
          {ticket?.component_name && (
            <>
              <span className="text-slate-700">·</span>
              <span className="font-mono text-[0.6rem] text-slate-500">{ticket.component_name}</span>
            </>
          )}
        </div>

        {/* ── BODY ── */}
        <div className="px-6 py-5 flex flex-col gap-5 flex-1">

          {/* Row 1 — SOP Code + Title */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="sop_code">
                SOP Code <span className="text-red-500">*</span>
              </label>
              <input
                id="sop_code"
                type="text"
                placeholder="e.g. SOP016"
                value={form.sop_code}
                onChange={handleChange}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="title">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                placeholder="e.g. API Intake Failure"
                value={form.title}
                onChange={handleChange}
                className={inputCls}
              />
            </div>
          </div>

          {/* Component Code — always editable */}
          <div>
            <label className={labelCls} htmlFor="component_code">
              Component Code <span className="text-red-500">*</span>
            </label>
            <input
              id="component_code"
              type="text"
              placeholder="e.g. CMP001"
              value={form.component_code}
              onChange={handleChange}
              className={`${inputCls} font-mono`}
            />
            <p className="text-[0.58rem] text-slate-600 font-mono mt-1">
              SOP will be nested under this component's Confluence page.
            </p>
          </div>

          {/* Keywords */}
          <div>
            <label className={labelCls} htmlFor="keywords">
              Keywords <span className="text-red-500">*</span>
            </label>
            <input
              id="keywords"
              type="text"
              placeholder="api down, tickets not created, intake failing"
              value={form.keywords}
              onChange={handleChange}
              className={inputCls}
            />
            <p className="text-[0.58rem] text-slate-600 mt-1">Comma-separated — used for vector search matching.</p>
          </div>

          {/* Symptoms */}
          <div>
            <label className={labelCls} htmlFor="symptoms">
              Symptoms <span className="text-red-500">*</span>
            </label>
            <textarea
              id="symptoms"
              rows={3}
              placeholder={"One symptom per line:\nTickets not appearing after submission\nAPI returning 500 on creation endpoint"}
              value={form.symptoms}
              onChange={handleChange}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Resolution Steps */}
          <div>
            <label className={labelCls} htmlFor="resolution_steps">
              Resolution Steps <span className="text-red-500">*</span>
            </label>
            <textarea
              id="resolution_steps"
              rows={6}
              placeholder={"One step per line:\nCheck API health endpoint\nReview intake service logs\nRestart service if unresponsive"}
              value={form.resolution_steps}
              onChange={handleChange}
              className={`${inputCls} resize-none`}
            />
            <p className="text-[0.58rem] text-slate-600 mt-1">
              Each line becomes a step. Commands can be added after the step on the same line using a <span className="font-mono text-slate-500">CMD:</span> prefix.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-mono text-red-400"
              style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}
            >
              <span>⚠</span> {error}
            </div>
          )}

        </div>

        {/* ── FOOTER ── */}
        <div className="flex gap-3 px-6 py-4 border-t border-purple-500/15 bg-[#1c2338] rounded-b-2xl sticky bottom-0">
          <button
            onClick={() => !loading && onCancel()}
            disabled={loading}
            className="flex-1 bg-transparent border border-slate-700/40 hover:border-slate-600 text-slate-400 hover:text-slate-300 text-xs font-mono py-2.5 rounded-xl transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 text-xs font-bold font-mono py-2.5 rounded-xl transition-all disabled:opacity-50"
            style={{
              background: loading
                ? "rgba(139,92,246,0.15)"
                : "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(109,40,217,0.4))",
              border: "1px solid rgba(139,92,246,0.35)",
              color: "#c4b5fd",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="w-3 h-3 rounded-full border-2 border-purple-400/30 border-t-purple-400 inline-block"
                  style={{ animation: "spin 0.7s linear infinite" }}
                />
                Creating SOP...
              </span>
            ) : (
              "✅ Create SOP"
            )}
          </button>
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease both; }
      `}</style>
    </div>
  );
}