import { Resend } from "resend";
import { prisma } from "./prisma";
import {
  emailWrapper,
  formatDate,
  infoRow,
  infoTable,
  primaryButton,
} from "./email-template";
import type { Lang } from "./email-template";
import { emailStrings } from "./email-strings";

// Lazy-initialized Resend client — reads API key from DB first, then env fallback
let _resend: Resend | null = null;
let _apiKeyChecked = false;

async function getResend(): Promise<Resend | null> {
  if (_resend && _apiKeyChecked) return _resend;

  // Try DB first
  const dbSetting = await prisma.systemSetting.findUnique({
    where: { key: "resend_api_key" },
  }).catch(() => null);

  const apiKey = dbSetting?.value || process.env.RESEND_API_KEY;
  _apiKeyChecked = true;

  if (!apiKey) {
    console.warn("[Email] No Resend API key configured (DB or env)");
    return null;
  }

  _resend = new Resend(apiKey);
  return _resend;
}

// Reset cached client when settings change (called after saving settings)
export function resetEmailClient() {
  _resend = null;
  _apiKeyChecked = false;
}

async function getEmailFrom(): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "email_from_name" },
  }).catch(() => null);

  const name = setting?.value || "Bobo's Farm";
  return `${name} <no-reply@mail.bobos.farm>`;
}

// ── User language preference ────────────────────────────────────────

async function getUserLang(email: string): Promise<Lang> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { preferredLanguage: true },
  });
  return user?.preferredLanguage === "ZH" ? "zh" : "en";
}

// ── Return type ─────────────────────────────────────────────────────

interface EmailResult {
  success: boolean;
  error?: string;
}

// ── 1. Reservation Created ──────────────────────────────────────────

interface ReservationCreatedData {
  reservationId: string;
  date: string | Date;
  yurtName: string;
  guestCount: number;
  depositAmount: number;
  paymentDeadline: string | Date | null;
  zelleRecipient?: string;
  zelleRecipientName?: string;
  memoCode?: string;
  siteUrl?: string;
}

export async function sendReservationCreated(
  to: string,
  data: ReservationCreatedData
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();
  const lang = await getUserLang(to);
  const s = emailStrings.reservationCreated[lang];
  const l = emailStrings.labels[lang];

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobos.farm";
    const deadlineStr = data.paymentDeadline ? formatDate(data.paymentDeadline, lang) : "N/A";

    const paymentInfo = data.zelleRecipient
      ? `<p style="font-size:13px;color:#3D2B1F;margin:12px 0 4px;">
          <strong>${l.zelleTitle}</strong><br/>
          ${l.zelleRecipient}: ${data.zelleRecipientName || data.zelleRecipient}<br/>
          Zelle: ${data.zelleRecipient}
          ${data.memoCode ? `<br/>${l.zelleMemo}: <strong style="color:#8B6914;">${data.memoCode}</strong>` : ""}
        </p>`
      : "";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#3D2B1F;">${s.title}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#4A4A4A;">${s.body}</p>

      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        infoRow(l.guests, l.guestUnit(data.guestCount)) +
        infoRow(l.deposit, `$${data.depositAmount}`) +
        infoRow(l.deadline, deadlineStr)
      )}

      ${paymentInfo}

      <p style="font-size:13px;color:#C4533A;margin:16px 0 0;">${s.warning}</p>

      ${primaryButton(s.button, `${siteUrl}/reservations`)}
    `, { lang, type: "transactional", siteUrl });

    await client.emails.send({ from: emailFrom, to, subject: s.subject, html });
    return { success: true };
  } catch (error) {
    console.error("[email] sendReservationCreated failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ── 2. Deposit Confirmed ────────────────────────────────────────────

interface DepositConfirmedData {
  date: string | Date;
  yurtName: string;
  guestCount: number;
  reservationId: string;
  siteUrl?: string;
}

export async function sendDepositConfirmed(
  to: string,
  data: DepositConfirmedData
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();
  const lang = await getUserLang(to);
  const s = emailStrings.depositConfirmed[lang];
  const l = emailStrings.labels[lang];

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobos.farm";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#3D2B1F;">${s.title}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#4A4A4A;">${s.body}</p>

      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        infoRow(l.guests, l.guestUnit(data.guestCount)) +
        infoRow(l.status, `<span style="color:#4A7C59;font-weight:bold;">${l.confirmed}</span>`)
      )}

      ${primaryButton(s.button, `${siteUrl}/pre-order?reservationId=${data.reservationId}`)}

      <p style="font-size:13px;color:#5A5A5A;margin:16px 0 0;">${s.footer}</p>
    `, { lang, type: "transactional", siteUrl });

    await client.emails.send({ from: emailFrom, to, subject: s.subject, html });
    return { success: true };
  } catch (error) {
    console.error("[email] sendDepositConfirmed failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ── 3. Payment Reminder ─────────────────────────────────────────────

interface PaymentReminderData {
  date: string | Date;
  yurtName: string;
  depositAmount: number;
  paymentDeadline: string | Date | null;
  zelleRecipient?: string;
  zelleRecipientName?: string;
  memoCode?: string;
  siteUrl?: string;
}

export async function sendPaymentReminder(
  to: string,
  data: PaymentReminderData
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();
  const lang = await getUserLang(to);
  const s = emailStrings.paymentReminder[lang];
  const l = emailStrings.labels[lang];

  try {
    const deadlineStr = data.paymentDeadline
      ? formatDate(data.paymentDeadline, lang)
      : s.expiringSoon;

    const remainingHours = data.paymentDeadline
      ? Math.max(0, Math.round((new Date(data.paymentDeadline).getTime() - Date.now()) / 3600000))
      : 0;

    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobos.farm";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#C4533A;">${s.title}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#4A4A4A;">${s.body}</p>

      <div style="background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;font-size:14px;color:#C4533A;font-weight:bold;">
          ${s.remaining}: ${s.hours(remainingHours)}
        </p>
        <p style="margin:4px 0 0;font-size:12px;color:#991B1B;">
          ${s.deadlineLabel}: ${deadlineStr}
        </p>
      </div>

      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        infoRow(l.deposit, `$${data.depositAmount}`)
      )}

      ${data.zelleRecipient
        ? `<p style="font-size:13px;color:#3D2B1F;margin:12px 0 4px;">
            <strong>${l.zelleTitle}</strong><br/>
            ${l.zelleRecipient}: ${data.zelleRecipientName || data.zelleRecipient}<br/>
            Zelle: ${data.zelleRecipient}
            ${data.memoCode ? `<br/>${l.zelleMemo}: <strong style="color:#8B6914;">${data.memoCode}</strong>` : ""}
          </p>`
        : ""
      }

      ${primaryButton(s.button, `${siteUrl}/reservations`)}

      <p style="font-size:12px;color:#C4533A;margin:16px 0 0;">${s.warning}</p>
    `, { lang, type: "transactional", siteUrl });

    await client.emails.send({ from: emailFrom, to, subject: s.subject, html });
    return { success: true };
  } catch (error) {
    console.error("[email] sendPaymentReminder failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ── 4. Admin — New Reservation ──────────────────────────────────────

interface AdminNewReservationData {
  guestName: string;
  date: string | Date;
  yurtName: string;
  guestCount: number;
  siteUrl?: string;
}

export async function sendAdminNewReservation(
  to: string,
  data: AdminNewReservationData
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobos.farm";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#3D2B1F;">新预订通知</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#5A5A5A;">
        有新的预订需要关注。
      </p>

      ${infoTable(
        infoRow("客人", data.guestName) +
        infoRow("预订日期", formatDate(data.date, "zh")) +
        infoRow("营地", data.yurtName) +
        infoRow("人数", `${data.guestCount} 人`)
      )}

      ${primaryButton("查看仪表盘", "https://admin.bobos.farm/admin/dashboard")}
    `, { lang: "zh", type: "transactional", siteUrl });

    await client.emails.send({
      from: emailFrom,
      to,
      subject: "新预订通知",
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("[email] sendAdminNewReservation failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ── 5. Admin — Deposit Submitted ────────────────────────────────────

interface AdminDepositSubmittedData {
  guestName: string;
  date: string | Date;
  yurtName: string;
  guestCount: number;
  depositAmount: number;
  siteUrl?: string;
}

export async function sendAdminDepositSubmitted(
  to: string,
  data: AdminDepositSubmittedData
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobos.farm";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#8B6914;">定金待确认</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#5A5A5A;">
        有客人已提交定金付款凭证，请及时确认。
      </p>

      ${infoTable(
        infoRow("客人", data.guestName) +
        infoRow("预订日期", formatDate(data.date, "zh")) +
        infoRow("营地", data.yurtName) +
        infoRow("人数", `${data.guestCount} 人`) +
        infoRow("定金金额", `$${data.depositAmount}`)
      )}

      ${primaryButton("前往确认定金", "https://admin.bobos.farm/admin/reservations")}
    `, { lang: "zh", type: "transactional", siteUrl });

    await client.emails.send({
      from: emailFrom,
      to,
      subject: "定金待确认",
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("[email] sendAdminDepositSubmitted failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ── 6. Yurt Assigned ────────────────────────────────────────────────

interface YurtAssignedData {
  date: string | Date;
  yurtName: string;
  yurtDescription?: string;
  guestCount: number;
  reservationId: string;
  siteUrl?: string;
}

export async function sendYurtAssigned(
  to: string,
  data: YurtAssignedData
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();
  const lang = await getUserLang(to);
  const s = emailStrings.yurtAssigned[lang];
  const l = emailStrings.labels[lang];

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobos.farm";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#3D2B1F;">${s.title}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#4A4A4A;">${s.body}</p>

      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        (data.yurtDescription ? infoRow(s.description, data.yurtDescription) : "") +
        infoRow(l.guests, l.guestUnit(data.guestCount))
      )}

      ${primaryButton(s.button, `${siteUrl}/reservations`)}

      <p style="font-size:13px;color:#5A5A5A;margin:16px 0 0;">${s.footer}</p>
    `, { lang, type: "transactional", siteUrl });

    await client.emails.send({ from: emailFrom, to, subject: s.subject, html });
    return { success: true };
  } catch (error) {
    console.error("[email] sendYurtAssigned failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ── 7. Reservation Modified ─────────────────────────────────────────

interface ReservationModifiedData {
  date: string | Date;
  yurtName: string;
  guestCount: number;
  changes: {
    date?: { from: string; to: string };
    yurt?: { from: string; to: string };
    guestCount?: { from: number; to: number };
  };
  reservationId: string;
  siteUrl?: string;
}

export async function sendReservationModified(
  to: string,
  data: ReservationModifiedData
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();
  const lang = await getUserLang(to);
  const s = emailStrings.reservationModified[lang];
  const l = emailStrings.labels[lang];

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobos.farm";

    // Build change rows
    let changeRows = "";
    if (data.changes.date) {
      changeRows += `<tr>
        <td style="padding:6px 12px;font-size:13px;color:#8A7E6B;">${l.date}</td>
        <td style="padding:6px 12px;font-size:14px;color:#3D2B1F;">
          <span style="text-decoration:line-through;color:#8A7E6B;">${formatDate(data.changes.date.from, lang)}</span>
          &nbsp;&rarr;&nbsp;
          <strong>${formatDate(data.changes.date.to, lang)}</strong>
        </td>
      </tr>`;
    }
    if (data.changes.yurt) {
      changeRows += `<tr>
        <td style="padding:6px 12px;font-size:13px;color:#8A7E6B;">${l.yurt}</td>
        <td style="padding:6px 12px;font-size:14px;color:#3D2B1F;">
          <span style="text-decoration:line-through;color:#8A7E6B;">${data.changes.yurt.from}</span>
          &nbsp;&rarr;&nbsp;
          <strong>${data.changes.yurt.to}</strong>
        </td>
      </tr>`;
    }
    if (data.changes.guestCount) {
      changeRows += `<tr>
        <td style="padding:6px 12px;font-size:13px;color:#8A7E6B;">${l.guests}</td>
        <td style="padding:6px 12px;font-size:14px;color:#3D2B1F;">
          <span style="text-decoration:line-through;color:#8A7E6B;">${l.guestUnit(data.changes.guestCount.from)}</span>
          &nbsp;&rarr;&nbsp;
          <strong>${l.guestUnit(data.changes.guestCount.to)}</strong>
        </td>
      </tr>`;
    }

    const changesTable = changeRows
      ? `<table cellpadding="0" cellspacing="0" style="width:100%;background-color:#FFF8E1;border-radius:8px;border:1px solid #E8D5A3;margin:16px 0;">
          ${changeRows}
        </table>`
      : "";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#3D2B1F;">${s.title}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#4A4A4A;">${s.body}</p>

      ${changesTable}

      <p style="margin:16px 0 8px;font-size:14px;color:#3D2B1F;font-weight:bold;">${s.updatedInfo}</p>
      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        infoRow(l.guests, l.guestUnit(data.guestCount))
      )}

      ${primaryButton(s.button, `${siteUrl}/reservations`)}

      <p style="font-size:13px;color:#5A5A5A;margin:16px 0 0;">${s.footer}</p>
    `, { lang, type: "transactional", siteUrl });

    await client.emails.send({ from: emailFrom, to, subject: s.subject, html });
    return { success: true };
  } catch (error) {
    console.error("[email] sendReservationModified failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ── 8. Reservation Cancelled ────────────────────────────────────────

interface ReservationCancelledData {
  date: string | Date;
  yurtName: string;
  guestCount: number;
  cancelReason?: string;
  depositAmount: number;
  depositStatus: string; // CONFIRMED → will refund; UNPAID/PENDING → no refund
  siteUrl?: string;
}

export async function sendReservationCancelled(
  to: string,
  data: ReservationCancelledData
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();
  const lang = await getUserLang(to);
  const s = emailStrings.reservationCancelled[lang];
  const l = emailStrings.labels[lang];

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobos.farm";
    const willRefund = data.depositStatus === "CONFIRMED";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#DC3545;">${s.title}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#4A4A4A;">${s.body}</p>

      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        infoRow(l.guests, l.guestUnit(data.guestCount)) +
        infoRow(l.status, `<span style="color:#DC3545;font-weight:bold;">${l.cancelled}</span>`)
      )}

      ${data.cancelReason ? `
        <div style="background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;font-size:13px;color:#991B1B;"><strong>${s.cancelReason}:</strong> ${data.cancelReason}</p>
        </div>
      ` : ""}

      ${willRefund ? `
        <p style="font-size:14px;color:#5A5A5A;margin:16px 0;">
          ${s.refundNote(data.depositAmount)}
        </p>
      ` : ""}

      ${primaryButton(s.button, `${siteUrl}/booking/date`)}

      <p style="font-size:13px;color:#5A5A5A;margin:16px 0 0;">
        ${s.contact}<br/>
        中文: (516) 272-9999 &nbsp;|&nbsp; English: (917) 502-0445
      </p>
    `, { lang, type: "transactional", siteUrl });

    await client.emails.send({ from: emailFrom, to, subject: s.subject, html });
    return { success: true };
  } catch (error) {
    console.error("[email] sendReservationCancelled failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ── Marketing Email Helper ─────────────────────────────────────────

/**
 * Send a marketing email with proper List-Unsubscribe headers.
 * Checks marketingOptIn before sending. For promotional/campaign emails only.
 */
export async function sendMarketingEmail(
  to: string,
  subject: string,
  body: string
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();
  const lang = await getUserLang(to);
  const siteUrl = process.env.NEXTAUTH_URL || "https://bobos.farm";

  const user = await prisma.user.findUnique({
    where: { email: to },
    select: { marketingOptIn: true, unsubscribeToken: true },
  });

  if (!user?.marketingOptIn) {
    return { success: false, error: "User has unsubscribed from marketing emails" };
  }

  const html = emailWrapper(body, {
    lang,
    type: "marketing",
    unsubscribeToken: user.unsubscribeToken ?? undefined,
    siteUrl,
  });

  const unsubUrl = user.unsubscribeToken
    ? `${siteUrl}/unsubscribe?token=${user.unsubscribeToken}`
    : undefined;

  try {
    await client.emails.send({
      from: emailFrom,
      to,
      subject,
      html,
      headers: unsubUrl
        ? {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
    });
    return { success: true };
  } catch (error) {
    console.error("[email] sendMarketingEmail failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
