import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ReceiptEditor from "../../../components/ReceiptEditor";

export default async function BillEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = await prisma.quickReceipt.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!receipt) notFound();
  return (
    <ReceiptEditor
      mode="edit"
      taxRate={receipt.taxRate}
      initial={{
        id: receipt.id,
        token: receipt.token,
        customerName: receipt.customerName,
        customerPhone: receipt.customerPhone,
        notes: receipt.notes,
        discountCents: receipt.discountCents,
        items: receipt.items.map(i => ({
          menuItemId: i.menuItemId ?? "",
          nameZhSnap: i.nameZhSnap,
          nameEnSnap: i.nameEnSnap,
          priceCents: i.priceCents,
          quantity: i.quantity,
        })),
      }}
    />
  );
}
