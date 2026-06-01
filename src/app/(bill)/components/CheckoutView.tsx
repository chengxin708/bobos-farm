"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, Plus, Minus, Trash2, UtensilsCrossed } from "lucide-react";
import { computeTotals, centsToDollarString, dollarsToCents } from "@/lib/bill/totals";
import ShareDialog from "./ShareDialog";

interface CartItem {
  menuItemId: string;
  nameEnSnap: string;
  nameZhSnap: string | null;
  priceCents: number;
  quantity: number;
}

interface ShareInfo {
  token: string;
  id: string;
}

interface Props {
  mode: "new" | "edit";
  taxRate: number;
  items: CartItem[];
  customerName: string;
  customerPhone: string;
  notes: string;
  discountInput: string;
  saving: boolean;
  share: ShareInfo | null;
  onBack: () => void;
  onAddMore: () => void;
  onUpdateQty: (menuItemId: string, delta: number) => void;
  onRemove: (menuItemId: string) => void;
  onCustomerName: (v: string) => void;
  onCustomerPhone: (v: string) => void;
  onNotes: (v: string) => void;
  onDiscountInput: (v: string) => void;
  onSave: () => void;
}

export default function CheckoutView({
  mode,
  taxRate,
  items,
  customerName,
  customerPhone,
  notes,
  discountInput,
  saving,
  share,
  onBack,
  onAddMore,
  onUpdateQty,
  onRemove,
  onCustomerName,
  onCustomerPhone,
  onNotes,
  onDiscountInput,
  onSave,
}: Props) {
  const discountCents = dollarsToCents(discountInput);
  const totals = useMemo(
    () =>
      computeTotals(
        items.map((i) => ({ priceCents: i.priceCents, quantity: i.quantity })),
        discountCents,
        taxRate,
      ),
    [items, discountCents, taxRate],
  );

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const canSave = items.length > 0 && !saving;
  // Item pending a delete confirmation (opened by 删除, or by − on the last unit)
  const [pendingDelete, setPendingDelete] = useState<CartItem | null>(null);

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-[#FCFAF5]">
      {/* Sticky header */}
      <div className="shrink-0 bg-[#FCFAF5] border-b border-[#E8ECE4] px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#F7F4EE] flex items-center justify-center press-effect shrink-0"
          aria-label="返回菜单"
        >
          <ChevronLeft className="w-5 h-5 text-[#1A1208]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-bold text-[#1A1208]">确认订单</h1>
          <p className="text-[12px] text-[#8C8478]">{itemCount} 件商品</p>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scrollbar-hide pb-44">
        <div className="px-4 pt-4 space-y-5">

          {/* Share dialog (shown after save) */}
          {share && (
            <ShareDialog
              token={share.token}
              phone={customerPhone.trim() || null}
              totalLabel={`$${centsToDollarString(totals.totalCents)}`}
              onClose={() => {}}
            />
          )}

          {/* Cart items */}
          <section>
            <h2 className="text-[13px] font-semibold text-[#8C8478] mb-2 uppercase tracking-wide">
              已选商品
            </h2>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#8C8478]">
                <UtensilsCrossed className="w-8 h-8 opacity-30" />
                <p className="text-sm">还没有商品</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div
                    key={it.menuItemId}
                    className="bg-white rounded-2xl p-4 shadow-card"
                  >
                    <div className="flex items-start gap-3">
                      {/* Thumbnail placeholder */}
                      <div className="w-12 h-12 rounded-xl bg-[#F7F4EE] flex items-center justify-center shrink-0">
                        <UtensilsCrossed className="w-4 h-4 text-[#8C8478]/30" />
                      </div>
                      {/* Name + price */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#1A1208] leading-snug">
                          {it.nameZhSnap ?? it.nameEnSnap}
                        </p>
                        <p className="text-[12px] text-[#8C8478] mt-0.5">
                          ${centsToDollarString(it.priceCents)} / 件
                        </p>
                      </div>
                      {/* Line total */}
                      <p className="text-[15px] font-bold text-[#1A1208] shrink-0">
                        ${centsToDollarString(it.priceCents * it.quantity)}
                      </p>
                    </div>

                    {/* Qty controls + remove */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E8ECE4]">
                      <button
                        onClick={() => setPendingDelete(it)}
                        className="flex items-center gap-1.5 text-[13px] text-red-500 font-medium press-effect"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>删除</span>
                      </button>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            it.quantity === 1
                              ? setPendingDelete(it)
                              : onUpdateQty(it.menuItemId, -1)
                          }
                          className="w-8 h-8 rounded-full bg-[#F7F4EE] flex items-center justify-center text-[#1A1208] press-effect border border-[#E8ECE4]"
                        >
                          <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </button>
                        <span className="text-[15px] font-semibold text-[#1A1208] w-5 text-center tabular-nums">
                          {it.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQty(it.menuItemId, 1)}
                          className="w-8 h-8 rounded-full bg-[#F7F4EE] flex items-center justify-center text-[#1A1208] press-effect border border-[#E8ECE4]"
                        >
                          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Continue adding */}
            <button
              onClick={onAddMore}
              className="mt-3 w-full py-3 rounded-2xl border border-dashed border-[#E8ECE4] text-sm text-[#6B7F5E] font-medium flex items-center justify-center gap-1.5 press-effect"
            >
              <Plus className="w-4 h-4" />
              继续加菜
            </button>
          </section>

          {/* Customer info */}
          <section className="bg-white rounded-2xl p-4 shadow-card space-y-3">
            <h2 className="text-[13px] font-semibold text-[#8C8478] uppercase tracking-wide">
              客人信息
            </h2>
            <div>
              <label className="text-xs text-[#8C8478] block mb-1">
                客人姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => onCustomerName(e.target.value)}
                placeholder="请填写姓名"
                className="w-full border border-[#E8ECE4] rounded-xl px-3 py-2.5 text-sm bg-[#FCFAF5] focus:outline-none focus:border-[#6B7F5E]"
              />
            </div>
            <div>
              <label className="text-xs text-[#8C8478] block mb-1">
                手机号 <span className="text-[#8C8478]/60">(用于 SMS 跳转)</span>
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => onCustomerPhone(e.target.value)}
                placeholder="可选"
                className="w-full border border-[#E8ECE4] rounded-xl px-3 py-2.5 text-sm bg-[#FCFAF5] focus:outline-none focus:border-[#6B7F5E]"
              />
            </div>
            <div>
              <label className="text-xs text-[#8C8478] block mb-1">备注</label>
              <textarea
                value={notes}
                onChange={(e) => onNotes(e.target.value)}
                placeholder="可选"
                rows={2}
                className="w-full border border-[#E8ECE4] rounded-xl px-3 py-2.5 text-sm bg-[#FCFAF5] focus:outline-none focus:border-[#6B7F5E] resize-none"
              />
            </div>
          </section>

          {/* Discount */}
          <section className="bg-white rounded-2xl p-4 shadow-card">
            <h2 className="text-[13px] font-semibold text-[#8C8478] uppercase tracking-wide mb-3">
              折扣
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#8C8478]">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={discountInput}
                onChange={(e) => onDiscountInput(e.target.value)}
                placeholder="0.00"
                className="flex-1 border border-[#E8ECE4] rounded-xl px-3 py-2.5 text-sm bg-[#FCFAF5] focus:outline-none focus:border-[#6B7F5E]"
              />
            </div>
          </section>

        </div>
      </div>

      {/* Fixed bottom: totals + save button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-[#E8ECE4] px-4 pt-3 pb-safe">
        {/* Totals */}
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-[13px] text-[#8C8478]">
            <span>小计</span>
            <span>${centsToDollarString(totals.subtotalCents)}</span>
          </div>
          {totals.discountCents > 0 && (
            <div className="flex justify-between text-[13px] text-[#6B7F5E]">
              <span>折扣</span>
              <span>-${centsToDollarString(totals.discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between text-[13px] text-[#8C8478]">
            <span>税 ({(taxRate * 100).toFixed(2)}%)</span>
            <span>${centsToDollarString(totals.taxCents)}</span>
          </div>
          <div className="flex justify-between text-[15px] font-bold text-[#1A1208] pt-1 border-t border-[#E8ECE4]">
            <span>合计</span>
            <span className="tabular-nums">
              ${centsToDollarString(totals.totalCents)}
            </span>
          </div>
        </div>

        {/* Save button */}
        {!canSave && items.length === 0 && (
          <p className="text-xs text-[#8C8478] text-center mb-2">至少加一项</p>
        )}
        <button
          onClick={onSave}
          disabled={!canSave}
          className="w-full bg-[#1A1208] text-white py-3.5 rounded-2xl font-semibold text-[15px] disabled:opacity-40 press-effect shadow-float"
        >
          {saving ? "保存中..." : mode === "new" ? "保存" : "更新"}
        </button>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="删除菜品"
          message={
            <>
              确认从订单中删除{" "}
              <span className="font-bold text-[#1A1208]">
                「{pendingDelete.nameZhSnap ?? pendingDelete.nameEnSnap}」
              </span>
              ？
            </>
          }
          confirmLabel="删除"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            onRemove(pendingDelete.menuItemId);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Confirm dialog (centered modal, not window.confirm) ─── */
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 animate-fade-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[300px] bg-[#FCFAF5] rounded-2xl shadow-float p-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-bold text-[#1A1208]">{title}</h3>
        <p className="mt-2 text-[14px] text-[#8C8478] leading-relaxed">{message}</p>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[#E8ECE4] bg-white text-[14px] font-semibold text-[#1A1208] press-effect"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[14px] font-semibold press-effect"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
