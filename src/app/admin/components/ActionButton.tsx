"use client";

import { useState } from "react";

interface ActionButtonProps {
  label: string;
  busyLabel?: string;
  className?: string;
  url: string;
  method?: "POST" | "DELETE";
  body?: Record<string, unknown>;
}

export default function ActionButton({
  label,
  busyLabel = "در حال انجام...",
  className = "",
  url,
  method = "POST",
  body,
}: ActionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      setMessage({ ok: Boolean(json.ok), text: json.message || (json.ok ? "انجام شد" : "خطا رخ داد") });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "خطای شبکه" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className={
          className ||
          "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        }
      >
        {loading ? busyLabel : label}
      </button>
      {message && (
        <p className={`text-xs ${message.ok ? "text-emerald-400" : "text-rose-400"}`}>{message.text}</p>
      )}
    </div>
  );
}
