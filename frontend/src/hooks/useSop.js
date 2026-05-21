// src/hooks/useSop.js

import { useState, useCallback } from "react";
import { apiRequest } from "../api/apiClient";

export function useSop(issueKey) {
  const [status,       setStatus]       = useState({ state: "running", text: "Fetching SOP...", time: "" });
  const [progress,     setProgress]     = useState(0);
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [isReadOnly,   setIsReadOnly]   = useState(false);
  const [escResult,    setEscResult]    = useState(null);

  const checkBeforeResolve = useCallback(async (issueKey) => {
    const res = await apiRequest(`/tickets/${issueKey}/can-complete`);
    return {
      allowed:      res.allowed,
      openChildren: res.open_children || [],
    };
  }, []);

  const updateStatus = useCallback((state, text) => {
    setStatus({ state, text, time: new Date().toLocaleTimeString() });
  }, []);

  const toggleCheck = useCallback((idx) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const selectAll = useCallback((paired) => {
    setCheckedItems(prev => {
      if (prev.size === paired.length) return new Set();
      return new Set(paired.map((_, i) => i));
    });
  }, []);

  const getProgress = useCallback((totalItems) => {
    if (!totalItems) return 0;
    return Math.round((checkedItems.size / totalItems) * 100);
  }, [checkedItems]);

  const fetchSop = useCallback(async () => {
    if (!issueKey || issueKey === "UNKNOWN") return;

    updateStatus("running", `Fetching SOP for ${issueKey}...`);
    setLoading(true);

    const sopRes = await apiRequest(`/tickets/${issueKey}/sop`);

    if (!sopRes || sopRes.error) {
      setError(sopRes?.message || "Unknown error");
      updateStatus("error", "Failed to load SOP");
      setLoading(false);
      return;
    }

    // ✅ read ticket status directly from SOP response
    const ticketCompleted = sopRes.ticket_status === "Completed";

    if (ticketCompleted) {
      console.log(`📦 [${issueKey}] Ticket already completed — read-only mode`);
      setIsReadOnly(true);
      updateStatus("done", `SOP loaded for ${issueKey} (read-only)`);
    } else {
      setIsReadOnly(false);
      updateStatus("done", `SOP loaded for ${issueKey}`);
    }

    setData(sopRes);
    setProgress(0);

    // Fetch escalation status
    const escRes = await apiRequest(`/tickets/${issueKey}/escalation-result`);
    if (escRes && !escRes.error && escRes.esc_action) {
      setEscResult(escRes);
      setIsReadOnly(true);
    }

    setLoading(false);
  }, [issueKey, updateStatus]);

  const completeTicket = useCallback(async () => {
    return await apiRequest(`/tickets/${issueKey}/complete`, "PUT");
  }, [issueKey]);

  const createSop = useCallback(async (payload) => {
    return await apiRequest("/sops", "POST", payload);
  }, []);

  return {
    status, progress, setProgress,
    data, loading, error,
    isReadOnly,
    checkedItems, toggleCheck, selectAll, getProgress,
    fetchSop, completeTicket, createSop, checkBeforeResolve,
    escResult,
  };
}