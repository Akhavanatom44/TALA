"use client";

import { useState } from "react";

export default function CopyBox({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative">
      {label && <p className="mb-1 text-xs text-slate-400">{label}</p>}
      <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
        <pre className="max-h-64 flex-1 overflow-auto whitespace-pre-wrap break-all text-left text-xs text-slate-300" dir="ltr">
          {text}
        </pre>
        <button
          onClick={copy}
          className="shrink-0 rounded-lg bg-orange-500/20 px-3 py-1.5 text-xs font-bold text-orange-400 hover:bg-orange-500/30"
        >
          {copied ? "✅ کپی شد" : "📋 کپی"}
        </button>
      </div>
    </div>
  );
}
