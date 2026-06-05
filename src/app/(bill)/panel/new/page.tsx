import { cookies } from "next/headers";
import ReceiptEditor from "../../components/ReceiptEditor";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/bill/session";

export default async function BillNewPage() {
  const c = await cookies();
  const { ai } = await verifySession(c.get(SESSION_COOKIE_NAME)?.value);
  const taxSetting = await prisma.systemSetting.findUnique({ where: { key: "tax_rate" } });
  const taxRate = taxSetting ? Number(taxSetting.value) : 0.08;
  return <ReceiptEditor mode="new" taxRate={taxRate} aiEnabled={ai} />;
}
