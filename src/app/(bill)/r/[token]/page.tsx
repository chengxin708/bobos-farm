import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { centsToDollarString } from "@/lib/bill/totals";
import TipBlock from "./TipBlock";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export default async function ReceiptPublicPage({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = await searchParams;
  const lang = sp.lang === "en" ? "en" : "zh";
  const receipt = await prisma.quickReceipt.findUnique({
    where: { token },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!receipt) notFound();

  const itemName = (en: string, zh: string | null) => (lang === "zh" ? (zh ?? en) : en);
  const t = lang === "zh"
    ? { subtotal: "小计", discount: "折扣", tax: "税", total: "总计", tip: "建议小费", grand: "含小费合计", langSwitch: "EN", title: "Bobo's Farm" }
    : { subtotal: "Subtotal", discount: "Discount", tax: "Tax", total: "Total", tip: "Suggested tip", grand: "Total with tip", langSwitch: "中", title: "Bobo's Farm" };

  return (
    <main className="max-w-md mx-auto px-5 py-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold">{t.title}</h1>
          <p className="text-xs text-[#8C8478]">891 Albany Post Rd, New Paltz, NY 12561</p>
          <p className="text-xs text-[#8C8478]">(516) 272-9999</p>
        </div>
        <a href={`?lang=${lang === "zh" ? "en" : "zh"}`} className="text-xs underline text-[#8C8478]">{t.langSwitch}</a>
      </div>

      <div className="mb-4">
        <p className="text-sm">{receipt.customerName}</p>
        <p className="text-xs text-[#8C8478]">{new Date(receipt.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</p>
      </div>

      <table className="w-full text-sm mb-4">
        <tbody>
          {receipt.items.map(i => (
            <tr key={i.id} className="border-b border-[#F0EDE7]">
              <td className="py-2">{itemName(i.nameEnSnap, i.nameZhSnap)} × {i.quantity}</td>
              <td className="py-2 text-right tabular-nums">${centsToDollarString(i.priceCents * i.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-1 text-sm mb-4">
        <div className="flex justify-between"><span>{t.subtotal}</span><span className="tabular-nums">${centsToDollarString(receipt.subtotalCents)}</span></div>
        {receipt.discountCents > 0 && (
          <div className="flex justify-between text-[#8C8478]"><span>{t.discount}</span><span className="tabular-nums">-${centsToDollarString(receipt.discountCents)}</span></div>
        )}
        <div className="flex justify-between text-[#8C8478]">
          <span>{t.tax} ({(receipt.taxRate * 100).toFixed(2)}%)</span>
          <span className="tabular-nums">${centsToDollarString(receipt.taxCents)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold pt-2 border-t border-[#E8ECE4]">
          <span>{t.total}</span><span className="tabular-nums">${centsToDollarString(receipt.totalCents)}</span>
        </div>
      </div>

      <TipBlock totalCents={receipt.totalCents} subtotalCents={receipt.subtotalCents} labels={{ tip: t.tip, grand: t.grand }} />

      {receipt.notes && (
        <div className="mt-6 text-xs text-[#8C8478] whitespace-pre-wrap">{receipt.notes}</div>
      )}
    </main>
  );
}
