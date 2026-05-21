import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/bill/session";
import PasswordForm from "./PasswordForm";

export default async function BillEntryPage() {
  const c = await cookies();
  const session = verifySession(c.get(SESSION_COOKIE_NAME)?.value);
  if (session.ok) redirect("/list");
  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-serif font-semibold mb-2">Bobo&apos;s Bill</h1>
      <p className="text-sm text-[#8C8478] mb-6">输入密码以继续</p>
      <PasswordForm />
    </div>
  );
}
