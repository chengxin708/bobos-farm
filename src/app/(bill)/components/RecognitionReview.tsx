"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  ChevronLeft,
  Plus,
  Minus,
  Trash2,
  Repeat,
  Search,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { centsToDollarString } from "@/lib/bill/totals";
import type { MenuItemLite } from "./MenuView";

/* ─── Contract types (shared with backend) ─── */
interface MatchedLine {
  menuItemId: string;
  nameEn: string;
  nameZh: string | null;
  priceCents: number;
  quantity: number;
  rawText: string;
  confidence: number | null;
}

interface UnmatchedLine {
  rawText: string;
  quantity: number;
  confidence: number | null;
}

interface RecognizeResponse {
  matched: MatchedLine[];
  unmatched: UnmatchedLine[];
}

export interface ConfirmLine {
  menuItemId: string;
  nameEn: string;
  nameZh: string | null;
  priceCents: number;
  quantity: number;
}

/* A single editable row in the review (matched or unmatched). When
   `menuItemId` is null the row is still unbound (an unmatched line). */
interface ReviewRow {
  key: string;
  rawText: string;
  menuItemId: string | null;
  nameEn: string | null;
  nameZh: string | null;
  priceCents: number | null;
  quantity: number;
  confidence: number | null;
}

interface Props {
  imageDataUrl: string;
  taxRate?: number;
  onConfirm: (lines: ConfirmLine[]) => void;
  onCancel: () => void;
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

let rowSeq = 0;
function nextKey(): string {
  rowSeq += 1;
  return `r${rowSeq}`;
}

export default function RecognitionReview({
  imageDataUrl,
  onConfirm,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchedRows, setMatchedRows] = useState<ReviewRow[]>([]);
  const [unmatchedRows, setUnmatchedRows] = useState<ReviewRow[]>([]);
  // Which row is currently picking a menu item (by key), or null.
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const reqSeq = useRef(0);

  async function run() {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bill/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });
      if (!res.ok) {
        let msg = "识别失败,请重试或手动点菜";
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* ignore non-JSON */
        }
        if (seq === reqSeq.current) setError(msg);
        return;
      }
      const json = (await res.json()) as RecognizeResponse;
      if (seq !== reqSeq.current) return;
      setMatchedRows(
        (json.matched ?? []).map((m) => ({
          key: nextKey(),
          rawText: m.rawText,
          menuItemId: m.menuItemId,
          nameEn: m.nameEn,
          nameZh: m.nameZh,
          priceCents: m.priceCents,
          quantity: m.quantity,
          confidence: m.confidence,
        })),
      );
      setUnmatchedRows(
        (json.unmatched ?? []).map((u) => ({
          key: nextKey(),
          rawText: u.rawText,
          menuItemId: null,
          nameEn: null,
          nameZh: null,
          priceCents: null,
          quantity: u.quantity,
          confidence: u.confidence,
        })),
      );
    } catch {
      if (seq === reqSeq.current) setError("识别失败,请重试或手动点菜");
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUrl]);

  function findRow(key: string): ReviewRow | undefined {
    return matchedRows.find((r) => r.key === key) ?? unmatchedRows.find((r) => r.key === key);
  }

  function updateRow(key: string, patch: Partial<ReviewRow>) {
    setMatchedRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
    setUnmatchedRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  function changeQty(key: string, delta: number) {
    const row = findRow(key);
    if (!row) return;
    updateRow(key, { quantity: Math.max(1, row.quantity + delta) });
  }

  function removeRow(key: string) {
    setMatchedRows((prev) => prev.filter((r) => r.key !== key));
    setUnmatchedRows((prev) => prev.filter((r) => r.key !== key));
  }

  // Bind / rebind a row to a chosen menu item. An unmatched row that gets
  // bound is promoted into the matched section.
  function bindMenuItem(key: string, m: MenuItemLite) {
    const wasUnmatched = unmatchedRows.some((r) => r.key === key);
    const patch: Partial<ReviewRow> = {
      menuItemId: m.id,
      nameEn: m.nameEn,
      nameZh: m.nameZh,
      priceCents: Math.round(m.price * 100),
    };
    if (wasUnmatched) {
      const row = unmatchedRows.find((r) => r.key === key);
      if (row) {
        setUnmatchedRows((prev) => prev.filter((r) => r.key !== key));
        setMatchedRows((prev) => [...prev, { ...row, ...patch }]);
      }
    } else {
      updateRow(key, patch);
    }
    setPickingFor(null);
  }

  const boundRows = useMemo(
    () => matchedRows.filter((r) => r.menuItemId !== null),
    [matchedRows],
  );

  function handleConfirm() {
    const lines: ConfirmLine[] = boundRows.map((r) => ({
      menuItemId: r.menuItemId as string,
      nameEn: r.nameEn ?? "",
      nameZh: r.nameZh,
      priceCents: r.priceCents ?? 0,
      quantity: r.quantity,
    }));
    onConfirm(lines);
  }

  /* ─── Loading ─── */
  if (loading) {
    return (
      <Shell onBack={onCancel}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[#8C8478]">
          <Loader2 className="w-8 h-8 animate-spin text-[#6B7F5E]" />
          <p className="text-sm">识别中,请稍候…</p>
        </div>
      </Shell>
    );
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <Shell onBack={onCancel}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <AlertCircle className="w-10 h-10 text-[#C77B4A]" />
          <p className="text-sm text-[#1A1208]">{error}</p>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={run}
              className="px-5 py-2.5 rounded-2xl bg-[#1A1208] text-white text-sm font-semibold press-effect shadow-float"
            >
              重试
            </button>
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-2xl border border-[#E8ECE4] text-sm font-medium text-[#6B7F5E] press-effect"
            >
              手动点菜
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  /* ─── Result ─── */
  const totalCount = boundRows.reduce((s, r) => s + r.quantity, 0);

  return (
    <Shell onBack={onCancel} subtitle={`已选 ${totalCount} 份`}>
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-4 pb-32 space-y-6">
        {/* Matched */}
        <section>
          <h2 className="text-[13px] font-semibold text-[#8C8478] uppercase tracking-wide mb-2">
            已匹配
          </h2>
          {matchedRows.length === 0 ? (
            <p className="text-sm text-[#8C8478] py-4 text-center">没有识别到可匹配的菜品</p>
          ) : (
            <div className="space-y-2">
              {matchedRows.map((r) => (
                <div key={r.key} className="bg-white rounded-2xl p-3.5 shadow-card">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#1A1208] leading-snug">
                        {r.nameZh ?? r.nameEn}
                      </p>
                      {r.nameZh && r.nameEn && (
                        <p className="text-[12px] text-[#8C8478] leading-snug truncate">
                          {r.nameEn}
                        </p>
                      )}
                      <p className="text-[13px] text-[#8C8478] mt-0.5">
                        ${centsToDollarString(r.priceCents ?? 0)}
                      </p>
                      {r.rawText && (
                        <p className="text-[11px] text-[#8C8478]/70 mt-1 truncate">
                          原文:{r.rawText}
                        </p>
                      )}
                    </div>
                    <Stepper
                      qty={r.quantity}
                      onDec={() => changeQty(r.key, -1)}
                      onInc={() => changeQty(r.key, 1)}
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-[#F0EDE6]">
                    <button
                      type="button"
                      onClick={() => setPickingFor(r.key)}
                      className="flex items-center gap-1 text-[13px] text-[#6B7F5E] font-medium press-effect"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      换菜品
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      className="flex items-center gap-1 text-[13px] text-[#C77B4A] font-medium press-effect"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Unmatched */}
        {unmatchedRows.length > 0 && (
          <section>
            <h2 className="text-[13px] font-semibold text-[#8C8478] uppercase tracking-wide mb-2">
              未匹配
            </h2>
            <div className="space-y-2">
              {unmatchedRows.map((r) => (
                <div
                  key={r.key}
                  className="bg-[#FBF6EE] border border-[#EBDFCB] rounded-2xl p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="inline-block text-[11px] font-medium text-[#C77B4A] bg-[#F6E7D6] rounded-full px-2 py-0.5 mb-1">
                        未匹配
                      </span>
                      <p className="text-[14px] font-semibold text-[#1A1208] leading-snug">
                        {r.rawText || "(空)"}
                      </p>
                      <p className="text-[12px] text-[#8C8478] mt-0.5 tabular-nums">
                        数量 ×{r.quantity}
                      </p>
                    </div>
                    <Stepper
                      qty={r.quantity}
                      onDec={() => changeQty(r.key, -1)}
                      onInc={() => changeQty(r.key, 1)}
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-[#EBDFCB]">
                    <button
                      type="button"
                      onClick={() => setPickingFor(r.key)}
                      className="flex items-center gap-1 text-[13px] text-[#6B7F5E] font-medium press-effect"
                    >
                      <Search className="w-3.5 h-3.5" />
                      选择菜品
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      className="flex items-center gap-1 text-[13px] text-[#8C8478] font-medium press-effect"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      丢弃
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-[#E8ECE4] px-4 pt-3 pb-safe">
        <div className="flex items-center gap-3 pb-3">
          <button
            onClick={onCancel}
            className="px-5 py-3.5 rounded-2xl border border-[#E8ECE4] text-sm font-medium text-[#6B7F5E] press-effect shrink-0"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={boundRows.length === 0}
            className="flex-1 bg-[#1A1208] text-white py-3.5 rounded-2xl font-semibold text-[15px] disabled:opacity-40 press-effect shadow-float"
          >
            确认并加入{totalCount > 0 ? ` (${totalCount})` : ""}
          </button>
        </div>
      </div>

      {/* Menu item picker overlay */}
      {pickingFor && (
        <MenuItemPicker
          onPick={(m) => bindMenuItem(pickingFor, m)}
          onClose={() => setPickingFor(null)}
        />
      )}
    </Shell>
  );
}

/* ─── Shell: sticky header + body column ─── */
function Shell({
  onBack,
  subtitle,
  children,
}: {
  onBack: () => void;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-[#FCFAF5]">
      <div className="shrink-0 bg-[#FCFAF5] border-b border-[#E8ECE4] px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#F7F4EE] flex items-center justify-center press-effect shrink-0"
          aria-label="返回菜单"
        >
          <ChevronLeft className="w-5 h-5 text-[#1A1208]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-bold text-[#1A1208]">识别核对</h1>
          {subtitle && <p className="text-[12px] text-[#8C8478]">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ─── Quantity stepper ─── */
function Stepper({
  qty,
  onDec,
  onInc,
}: {
  qty: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex items-center h-9 rounded-full bg-white border border-[#E8ECE4] shadow-md shrink-0 select-none">
      <button
        type="button"
        onClick={onDec}
        aria-label="减少"
        className="w-9 h-9 rounded-full flex items-center justify-center text-[#1A1208] active:bg-[#F0EDE6] transition-colors touch-manipulation"
      >
        <Minus className="w-[18px] h-[18px]" strokeWidth={2.5} />
      </button>
      <span className="min-w-[22px] text-center text-[15px] font-bold text-[#1A1208] tabular-nums">
        {qty}
      </span>
      <button
        type="button"
        onClick={onInc}
        aria-label="增加"
        className="w-9 h-9 rounded-full flex items-center justify-center text-[#1A1208] active:bg-[#F0EDE6] transition-colors touch-manipulation"
      >
        <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/* ─── Menu item picker (full-screen overlay over /api/menu/items) ─── */
function MenuItemPicker({
  onPick,
  onClose,
}: {
  onPick: (m: MenuItemLite) => void;
  onClose: () => void;
}) {
  const { data: menuItems, isLoading } = useSWR<MenuItemLite[]>(
    "/api/menu/items?activeOnly=true",
    fetcher,
  );
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const list = menuItems ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => {
      const zh = (m.nameZh ?? "").toLowerCase();
      const en = m.nameEn.toLowerCase();
      return zh.includes(q) || en.includes(q);
    });
  }, [menuItems, query]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FCFAF5]">
      <div className="shrink-0 bg-[#FCFAF5] border-b border-[#E8ECE4] px-4 py-3 flex items-center gap-3">
        <h2 className="text-[16px] font-bold text-[#1A1208] flex-1">选择菜品</h2>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-[#F7F4EE] flex items-center justify-center press-effect shrink-0"
          aria-label="关闭"
        >
          <X className="w-5 h-5 text-[#1A1208]" />
        </button>
      </div>
      <div className="shrink-0 px-4 py-3">
        <div className="flex items-center gap-2 bg-white border border-[#E8ECE4] rounded-xl px-3 py-2.5">
          <Search className="w-4 h-4 text-[#8C8478] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索菜品名"
            autoFocus
            className="flex-1 text-sm bg-transparent focus:outline-none text-[#1A1208]"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-safe">
        {isLoading && (
          <div className="space-y-2 pt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 rounded-2xl bg-white shadow-card" />
            ))}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-[#8C8478] text-center pt-12">没有匹配的菜品</p>
        )}
        <div className="space-y-2 pb-4">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m)}
              className="w-full flex items-center gap-3 bg-white rounded-2xl p-3.5 shadow-card text-left press-effect"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#1A1208] leading-snug">
                  {m.nameZh ?? m.nameEn}
                </p>
                {m.nameZh && m.nameEn && (
                  <p className="text-[12px] text-[#8C8478] truncate">{m.nameEn}</p>
                )}
              </div>
              <span className="text-[14px] font-bold text-[#1A1208] tabular-nums shrink-0">
                ${m.price.toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
