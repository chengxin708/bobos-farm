"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Minus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { computeTotals, centsToDollarString, dollarsToCents } from "@/lib/bill/totals";
import MenuPickerSheet, { MenuItemLite } from "./MenuPickerSheet";
import ShareDialog from "./ShareDialog";

interface EditorItem {
  menuItemId: string;
  nameZhSnap: string | null;
  nameEnSnap: string;
  priceCents: number;
  quantity: number;
}

interface Initial {
  id: string;
  token: string;
  customerName: string;
  customerPhone: string | null;
  notes: string | null;
  discountCents: number;
  items: EditorItem[];
}

interface Props {
  mode: "new" | "edit";
  taxRate: number;
  initial?: Initial;
}

export default function ReceiptEditor({ mode, taxRate, initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<EditorItem[]>(initial?.items ?? []);
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initial?.customerPhone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [discountInput, setDiscountInput] = useState(
    initial ? centsToDollarString(initial.discountCents) : "0",
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [share, setShare] = useState<{ token: string; id: string } | null>(
    initial ? { token: initial.token, id: initial.id } : null,
  );

  const discountCents = dollarsToCents(discountInput);
  const totals = useMemo(
    () => computeTotals(items.map(i => ({ priceCents: i.priceCents, quantity: i.quantity })), discountCents, taxRate),
    [items, discountCents, taxRate],
  );

  function addOrIncrement(m: MenuItemLite) {
    setItems(prev => {
      const idx = prev.findIndex(it => it.menuItemId === m.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, {
        menuItemId: m.id,
        nameEnSnap: m.nameEn,
        nameZhSnap: m.nameZh,
        priceCents: Math.round(m.price * 100),
        quantity: 1,
      }];
    });
  }

  function updateQty(menuItemId: string, delta: number) {
    setItems(prev => prev
      .map(it => it.menuItemId === menuItemId ? { ...it, quantity: it.quantity + delta } : it)
      .filter(it => it.quantity > 0));
  }

  function removeRow(menuItemId: string) {
    setItems(prev => prev.filter(it => it.menuItemId !== menuItemId));
  }

  async function onSave() {
    if (!customerName.trim()) {
      alert("请填写客人姓名");
      return;
    }
    if (items.length === 0) {
      alert("至少添加一项");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        notes: notes.trim() || null,
        discountCents: totals.discountCents,
        items: items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
      };
      const url = mode === "new" ? "/api/bill/receipts" : `/api/bill/receipts/${initial!.id}`;
      const method = mode === "new" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(`保存失败: ${txt}`);
        return;
      }
      const json = await res.json();
      setShare({ token: json.token, id: json.id });
      if (mode === "new") router.replace(`/edit/${json.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 pb-32">
      <Link href="/list" className="inline-flex items-center text-sm text-[#8C8478]"><ArrowLeft className="w-4 h-4 mr-1" /> 返回列表</Link>

      {share && (
        <ShareDialog
          token={share.token}
          phone={customerPhone.trim() || null}
          totalLabel={`$${centsToDollarString(totals.totalCents)}`}
          onClose={() => { /* keep dialog visible — it's an inline panel */ }}
        />
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">商品</h3>
          <button onClick={() => setPickerOpen(true)} className="text-sm text-[#6B7F5E] inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> 加菜
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-[#8C8478]">还没有商品。</p>
        ) : (
          <ul className="divide-y divide-[#E8ECE4]">
            {items.map(it => (
              <li key={it.menuItemId} className="py-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.nameZhSnap || it.nameEnSnap}</div>
                  <div className="text-xs text-[#8C8478]">${centsToDollarString(it.priceCents)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(it.menuItemId, -1)} className="p-1 border border-[#E8ECE4] rounded"><Minus className="w-3 h-3" /></button>
                  <span className="w-6 text-center text-sm tabular-nums">{it.quantity}</span>
                  <button onClick={() => updateQty(it.menuItemId, +1)} className="p-1 border border-[#E8ECE4] rounded"><Plus className="w-3 h-3" /></button>
                </div>
                <button onClick={() => removeRow(it.menuItemId)} className="p-1 text-red-500"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <label className="text-xs text-[#8C8478]">折扣 ($)</label>
          <input
            type="text"
            inputMode="decimal"
            value={discountInput}
            onChange={e => setDiscountInput(e.target.value)}
            className="w-full border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[#8C8478]">客人姓名 *</label>
          <input
            type="text"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="w-full border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[#8C8478]">手机号(用于 SMS 跳转)</label>
          <input
            type="tel"
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
            className="w-full border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[#8C8478]">备注</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8ECE4] px-4 py-3">
        <div className="max-w-md mx-auto">
          <div className="text-xs text-[#8C8478] mb-1 flex justify-between"><span>Subtotal</span><span>${centsToDollarString(totals.subtotalCents)}</span></div>
          {totals.discountCents > 0 && (
            <div className="text-xs text-[#8C8478] mb-1 flex justify-between"><span>Discount</span><span>-${centsToDollarString(totals.discountCents)}</span></div>
          )}
          <div className="text-xs text-[#8C8478] mb-1 flex justify-between"><span>Tax ({(taxRate * 100).toFixed(2)}%)</span><span>${centsToDollarString(totals.taxCents)}</span></div>
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-semibold tabular-nums">${centsToDollarString(totals.totalCents)}</span>
          </div>
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full bg-[#1A1208] text-white py-2.5 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? "保存中..." : (mode === "new" ? "保存" : "更新")}
          </button>
        </div>
      </div>

      <MenuPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addOrIncrement} />
    </div>
  );
}
