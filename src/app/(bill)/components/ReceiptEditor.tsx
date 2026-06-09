"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MenuView, { MenuItemLite } from "./MenuView";
import CheckoutView from "./CheckoutView";
import RecognitionReview, { ConfirmLine } from "./RecognitionReview";
import { PENDING_RECOGNIZE_IMAGE_KEY } from "./photoCapture";
import { centsToDollarString } from "@/lib/bill/totals";

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

type View = "menu" | "checkout" | "recognize";

function centsToDollarInput(cents: number): string {
  return centsToDollarString(cents);
}

export default function ReceiptEditor({ mode, taxRate, initial }: Props) {
  const router = useRouter();

  const [view, setView] = useState<View>(mode === "edit" ? "checkout" : "menu");
  const [cameFromCheckout, setCameFromCheckout] = useState(false);
  const [recognizeImage, setRecognizeImage] = useState<string | null>(null);
  const [items, setItems] = useState<EditorItem[]>(initial?.items ?? []);
  const [customerName, setCustomerName] = useState(
    initial?.customerName ?? "",
  );
  const [customerPhone, setCustomerPhone] = useState(
    initial?.customerPhone ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [discountInput, setDiscountInput] = useState(
    initial ? centsToDollarInput(initial.discountCents) : "0",
  );
  const [saving, setSaving] = useState(false);
  const [share, setShare] = useState<{ token: string; id: string } | null>(
    initial ? { token: initial.token, id: initial.id } : null,
  );
  // Track current receipt id (may change after first save)
  const [receiptId, setReceiptId] = useState<string | null>(
    initial?.id ?? null,
  );

  // 拍照新建 on the list page stashes the captured photo in sessionStorage
  // and navigates here; pick it up and jump straight into recognition.
  useEffect(() => {
    if (mode !== "new") return;
    const pending = sessionStorage.getItem(PENDING_RECOGNIZE_IMAGE_KEY);
    if (pending) {
      sessionStorage.removeItem(PENDING_RECOGNIZE_IMAGE_KEY);
      setRecognizeImage(pending);
      setView("recognize");
    }
  }, [mode]);

  function addOrIncrement(m: MenuItemLite) {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.menuItemId === m.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          menuItemId: m.id,
          nameEnSnap: m.nameEn,
          nameZhSnap: m.nameZh,
          priceCents: Math.round(m.price * 100),
          quantity: 1,
        },
      ];
    });
  }

  // Merge recognized lines into the cart using the same accumulate-by-id
  // semantics as addOrIncrement, but honoring each line's quantity (>=1).
  function mergeRecognized(lines: ConfirmLine[]) {
    setItems((prev) => {
      const next = [...prev];
      for (const line of lines) {
        const qty = Math.max(1, line.quantity);
        const idx = next.findIndex((it) => it.menuItemId === line.menuItemId);
        if (idx >= 0) {
          next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        } else {
          next.push({
            menuItemId: line.menuItemId,
            nameEnSnap: line.nameEn,
            nameZhSnap: line.nameZh,
            priceCents: line.priceCents,
            quantity: qty,
          });
        }
      }
      return next;
    });
  }

  function updateQty(menuItemId: string, delta: number) {
    setItems((prev) =>
      prev
        .map((it) =>
          it.menuItemId === menuItemId
            ? { ...it, quantity: it.quantity + delta }
            : it,
        )
        .filter((it) => it.quantity > 0),
    );
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
      const discountCentsValue = Math.round(
        parseFloat(discountInput || "0") * 100,
      );
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        notes: notes.trim() || null,
        discountCents: Number.isFinite(discountCentsValue)
          ? Math.max(0, discountCentsValue)
          : 0,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
        })),
      };

      const isNew = mode === "new" && !receiptId;
      const url = isNew
        ? "/api/bill/receipts"
        : `/api/bill/receipts/${receiptId ?? initial!.id}`;
      const method = isNew ? "POST" : "PATCH";

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

      const json = await res.json() as { token: string; id: string };
      setShare({ token: json.token, id: json.id });
      setReceiptId(json.id);

      if (mode === "new" && isNew) {
        router.replace(`/edit/${json.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  if (view === "recognize" && recognizeImage) {
    return (
      <RecognitionReview
        imageDataUrl={recognizeImage}
        taxRate={taxRate}
        onConfirm={(lines) => {
          mergeRecognized(lines);
          setRecognizeImage(null);
          setView("menu");
        }}
        onCancel={() => {
          setRecognizeImage(null);
          setView("menu");
        }}
      />
    );
  }

  if (view === "menu") {
    return (
      <MenuView
        mode={mode}
        items={items}
        onAddItem={addOrIncrement}
        onUpdateQty={updateQty}
        onCheckout={() => setView("checkout")}
        onOpenRecognize={(imageDataUrl) => {
          setRecognizeImage(imageDataUrl);
          setView("recognize");
        }}
        onBack={() => {
          if (cameFromCheckout) {
            setCameFromCheckout(false);
            setView("checkout");
          } else {
            router.push("/list");
          }
        }}
      />
    );
  }

  return (
    <CheckoutView
      mode={mode}
      taxRate={taxRate}
      items={items}
      customerName={customerName}
      customerPhone={customerPhone}
      notes={notes}
      discountInput={discountInput}
      saving={saving}
      share={share}
      onBack={() => {
        if (mode === "edit") {
          router.push("/list");
        } else {
          setView("menu");
        }
      }}
      onAddMore={() => {
        setCameFromCheckout(true);
        setView("menu");
      }}
      onCustomerName={setCustomerName}
      onCustomerPhone={setCustomerPhone}
      onNotes={setNotes}
      onDiscountInput={setDiscountInput}
      onSave={onSave}
    />
  );
}
