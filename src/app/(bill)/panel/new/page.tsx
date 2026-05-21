import ReceiptEditor from "../../components/ReceiptEditor";
import { prisma } from "@/lib/prisma";

export default async function BillNewPage() {
  const taxSetting = await prisma.systemSetting.findUnique({ where: { key: "tax_rate" } });
  const taxRate = taxSetting ? Number(taxSetting.value) : 0.08;
  return <ReceiptEditor mode="new" taxRate={taxRate} />;
}
