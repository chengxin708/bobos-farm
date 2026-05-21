"use client";

import { useState } from "react";
import { centsToDollarString } from "@/lib/bill/totals";

interface Props {
  subtotalCents: number;
  totalCents: number;
  labels: { tip: string; grand: string };
}

const SUGGESTIONS: { label: string; pct: number }[] = [
  { label: "10%", pct: 0.10 },
  { label: "15%", pct: 0.15 },
  { label: "20%", pct: 0.20 },
];

export default function TipBlock({ subtotalCents, totalCents, labels }: Props) {
  const [tipCents, setTipCents] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const grand = totalCents + tipCents;

  function applyPct(pct: number) {
    setTipCents(Math.round(subtotalCents * pct));
    setCustomInput("");
  }

  function applyCustom(v: string) {
    setCustomInput(v);
    const n = parseFloat(v);
    setTipCents(Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0);
  }

  return (
    <div className="bg-[#FCFAF5] border border-[#E8ECE4] rounded-lg p-4">
      <div className="text-xs text-[#8C8478] mb-2">{labels.tip}</div>
      <div className="flex gap-2 mb-2">
        {SUGGESTIONS.map(s => (
          <button
            key={s.label}
            onClick={() => applyPct(s.pct)}
            className="flex-1 border border-[#E8ECE4] rounded-lg py-1.5 text-sm bg-white"
          >
            {s.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        inputMode="decimal"
        placeholder="自定义 $"
        value={customInput}
        onChange={e => applyCustom(e.target.value)}
        className="w-full border border-[#E8ECE4] rounded-lg px-3 py-1.5 text-sm"
      />
      {tipCents > 0 && (
        <div className="mt-3 text-sm space-y-1">
          <div className="flex justify-between"><span>{labels.tip}</span><span className="tabular-nums">${centsToDollarString(tipCents)}</span></div>
          <div className="flex justify-between font-semibold"><span>{labels.grand}</span><span className="tabular-nums">${centsToDollarString(grand)}</span></div>
        </div>
      )}
    </div>
  );
}
