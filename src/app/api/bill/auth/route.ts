import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyBillPassword } from "@/lib/bill/password";
import {
  signSession,
  newSessionExpiresAt,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "@/lib/bill/session";

const bodySchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = verifyBillPassword(parsed.data.password, ip);
  if (result.throttled) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const expiresAt = newSessionExpiresAt();
  const cookieValue = await signSession(expiresAt, result.ai);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
