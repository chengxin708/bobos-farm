import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unsubscribe — Bobo's Farm",
};

/* ── bilingual strings ────────────────────────────────── */
const t = {
  EN: {
    unsubscribed:
      "You have been unsubscribed from Bobo's Farm marketing emails.",
    resubscribed:
      "You have been resubscribed to Bobo's Farm marketing emails!",
    errorNoToken: "Invalid unsubscribe link.",
    errorBadToken: "This unsubscribe link is invalid or has expired.",
    resubscribeBtn: "Resubscribe",
    unsubscribeBtn: "Unsubscribe again",
    homeLink: "Return to Bobo's Farm",
  },
  ZH: {
    unsubscribed: "您已成功退订 Bobo's Farm 的营销邮件。",
    resubscribed: "您已重新订阅 Bobo's Farm 的营销邮件！",
    errorNoToken: "退订链接无效。",
    errorBadToken: "此退订链接无效或已过期。",
    resubscribeBtn: "重新订阅",
    unsubscribeBtn: "再次退订",
    homeLink: "返回 Bobo's Farm",
  },
} as const;

type Lang = keyof typeof t;

/* ── page component ───────────────────────────────────── */
interface Props {
  searchParams: Promise<{ token?: string; action?: string }>;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token, action } = await searchParams;

  /* --- no token in URL -------------------------------- */
  if (!token) {
    return <Shell lang="EN" status="error" message={t.EN.errorNoToken} />;
  }

  /* --- look up user by token -------------------------- */
  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, preferredLanguage: true, marketingOptIn: true },
  });

  if (!user) {
    return <Shell lang="EN" status="error" message={t.EN.errorBadToken} />;
  }

  const lang: Lang = user.preferredLanguage === "ZH" ? "ZH" : "EN";
  const strings = t[lang];

  /* --- resubscribe ------------------------------------ */
  if (action === "resubscribe") {
    if (!user.marketingOptIn) {
      await prisma.user.update({
        where: { id: user.id },
        data: { marketingOptIn: true },
      });
    }
    return (
      <Shell lang={lang} status="success" message={strings.resubscribed}>
        <ActionLink
          href={`/unsubscribe?token=${token}`}
          label={strings.unsubscribeBtn}
        />
      </Shell>
    );
  }

  /* --- unsubscribe (default) -------------------------- */
  if (user.marketingOptIn) {
    await prisma.user.update({
      where: { id: user.id },
      data: { marketingOptIn: false },
    });
  }
  return (
    <Shell lang={lang} status="success" message={strings.unsubscribed}>
      <ActionLink
        href={`/unsubscribe?token=${token}&action=resubscribe`}
        label={strings.resubscribeBtn}
      />
    </Shell>
  );
}

/* ── shared UI shell ──────────────────────────────────── */
function Shell({
  lang,
  status,
  message,
  children,
}: {
  lang: Lang;
  status: "success" | "error";
  message: string;
  children?: React.ReactNode;
}) {
  const homeLabel = t[lang].homeLink;

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px] rounded-2xl overflow-hidden shadow-lg bg-white">
        {/* Green header */}
        <div
          className="px-6 py-8 text-center"
          style={{
            background: "linear-gradient(135deg, #4A7C59 0%, #5B8C3E 100%)",
          }}
        >
          <p
            className="text-white text-2xl tracking-wide"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {"Bobo's Farm"}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-10 text-center space-y-6">
          {/* Status icon */}
          {status === "success" ? (
            <div className="mx-auto w-14 h-14 rounded-full bg-[#EFF6EB] flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#5B8C3E"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : (
            <div className="mx-auto w-14 h-14 rounded-full bg-[#FEF3E7] flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#B45309"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          )}

          {/* Message */}
          <p className="text-[#3D2B1F] text-base leading-relaxed font-sans">
            {message}
          </p>

          {/* Action button (resubscribe / unsubscribe again) */}
          {children}

          {/* Home link */}
          <Link
            href="/"
            className="inline-block text-sm text-[#6B6157] hover:text-[#5B8C3E] transition-colors no-underline"
          >
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── action link styled as button ─────────────────────── */
function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-block px-6 py-3 rounded-full text-white text-sm font-medium no-underline transition-colors"
      style={{ backgroundColor: "#5B8C3E" }}
    >
      {label}
    </Link>
  );
}
