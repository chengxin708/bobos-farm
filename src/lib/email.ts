import { Resend } from "resend";
import { prisma } from "./prisma";
import {
  emailWrapper,
  formatDate,
  infoRow,
  infoTable,
  primaryButton,
  sectionTitle,
  divider,
  badge,
} from "./email-template";
import type { Lang } from "./email-template";
import { emailStrings } from "./email-strings";

// Lazy-initialized Resend client — reads API key from DB first, then env fallback
let _resend: Resend | null = null;
let _apiKeyChecked = false;

async function getResend(): Promise<Resend | null> {
  if (_resend) return _resend;

  // Try DB first
  const dbSetting = await prisma.systemSetting.findUnique({
    where: { key: "resend_api_key" },
  }).catch(() => null);

  const apiKey = dbSetting?.value || process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[Email] No Resend API key configured (DB or env)");
    return null; // Don't cache failure — retry next call
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

// ── Debounce — prevent duplicate emails within cooldown ────────────

const EMAIL_COOLDOWN_MS = 120_000; // 2 minutes

/**
 * Check if an email was recently sent for this reservation.
 * Returns true if we should skip (still in cooldown).
 * If not in cooldown, marks the timestamp so future calls within
 * the window will be skipped.
 */
export async function shouldSkipEmail(reservationId: string, emailType: string): Promise<boolean> {
  const key = `email_cooldown_${emailType}`;
  const log = await prisma.activityLog.findFirst({
    where: {
      targetId: reservationId,
      targetType: "Reservation",
      action: key,
    },
    orderBy: { createdAt: "desc" },
  });

  if (log && Date.now() - new Date(log.createdAt).getTime() < EMAIL_COOLDOWN_MS) {
    return true; // Still in cooldown
  }

  // Mark this email as sent
  await prisma.activityLog.create({
    data: {
      userId: null,
      action: key,
      targetType: "Reservation",
      targetId: reservationId,
      details: { emailType, sentAt: new Date().toISOString() },
    },
  });

  return false;
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
      <h2 style="margin:0 0 6px;font-size:22px;color:#2C2416;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${s.title}</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B6157;line-height:1.6;">${s.body}</p>

      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        infoRow(l.guests, l.guestUnit(data.guestCount)) +
        infoRow(l.deposit, `$${data.depositAmount}`) +
        infoRow(l.deadline, deadlineStr)
      )}

      ${paymentInfo}

      <div style="background-color:#FEF3E2;border-radius:10px;padding:14px 16px;margin:16px 0;">
        <p style="margin:0;font-size:13px;color:#92400E;line-height:1.5;">${s.warning}</p>
      </div>

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
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;width:48px;height:48px;border-radius:50%;background-color:#E8F0E4;line-height:48px;text-align:center;font-size:22px;">&#10003;</div>
      </div>
      <h2 style="margin:0 0 6px;font-size:22px;color:#2C2416;font-family:Georgia,'Times New Roman',serif;font-weight:700;text-align:center;">${s.title}</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#6B6157;line-height:1.6;text-align:center;">${s.body}</p>

      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        infoRow(l.guests, l.guestUnit(data.guestCount)) +
        infoRow(l.status, badge(l.confirmed, 'green'))
      )}

      ${primaryButton(s.button, `${siteUrl}/pre-order?reservationId=${data.reservationId}`)}

      <p style="font-size:13px;color:#9C9588;margin:20px 0 0;text-align:center;line-height:1.5;">${s.footer}</p>
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
      <h2 style="margin:0 0 6px;font-size:22px;color:#2C2416;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${s.title}</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B6157;line-height:1.6;">${s.body}</p>

      <div style="background-color:#FDE8E8;border-radius:12px;padding:16px 20px;margin:16px 0;">
        <p style="margin:0;font-size:15px;color:#C4453A;font-weight:700;">
          ${s.remaining}: ${s.hours(remainingHours)}
        </p>
        <p style="margin:4px 0 0;font-size:13px;color:#C4453A;">
          ${s.deadlineLabel}: ${deadlineStr}
        </p>
      </div>

      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        infoRow(l.deposit, `$${data.depositAmount}`)
      )}

      ${data.zelleRecipient
        ? `<div style="background-color:#FAFAF8;border-radius:10px;padding:14px 16px;margin:12px 0;">
            <p style="margin:0;font-size:13px;color:#2C2416;">
              <strong>${l.zelleTitle}</strong><br/>
              ${l.zelleRecipient}: ${data.zelleRecipientName || data.zelleRecipient}<br/>
              Zelle: ${data.zelleRecipient}
              ${data.memoCode ? `<br/>${l.zelleMemo}: <strong style="color:#8B6914;">${data.memoCode}</strong>` : ""}
            </p>
          </div>`
        : ""
      }

      ${primaryButton(s.button, `${siteUrl}/reservations`)}

      <p style="font-size:12px;color:#C4453A;margin:20px 0 0;text-align:center;">${s.warning}</p>
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
      <h2 style="margin:0 0 6px;font-size:22px;color:#2C2416;font-family:Georgia,'Times New Roman',serif;font-weight:700;">新预订通知</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B6157;">有新的预订需要关注。</p>

      ${infoTable(
        infoRow("客人", data.guestName) +
        infoRow("预订日期", formatDate(data.date, "zh")) +
        infoRow("营地", data.yurtName) +
        infoRow("人数", `${data.guestCount} 人`)
      )}

      ${primaryButton("查看仪表盘", `${siteUrl}/admin/dashboard`)}
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
      <h2 style="margin:0 0 6px;font-size:22px;color:#2C2416;font-family:Georgia,'Times New Roman',serif;font-weight:700;">定金待确认</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B6157;">有客人已提交定金付款凭证，请及时确认。</p>

      ${infoTable(
        infoRow("客人", data.guestName) +
        infoRow("预订日期", formatDate(data.date, "zh")) +
        infoRow("营地", data.yurtName) +
        infoRow("人数", `${data.guestCount} 人`) +
        infoRow("定金金额", `$${data.depositAmount}`)
      )}

      ${primaryButton("前往确认定金", `${siteUrl}/admin/reservations`)}
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
      <h2 style="margin:0 0 6px;font-size:22px;color:#2C2416;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${s.title}</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B6157;line-height:1.6;">${s.body}</p>

      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, `<strong>${data.yurtName}</strong>`) +
        (data.yurtDescription ? infoRow(s.description, data.yurtDescription) : "") +
        infoRow(l.guests, l.guestUnit(data.guestCount))
      )}

      ${primaryButton(s.button, `${siteUrl}/reservations`)}

      <p style="font-size:13px;color:#9C9588;margin:20px 0 0;text-align:center;line-height:1.5;">${s.footer}</p>
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
      ? `<table cellpadding="0" cellspacing="0" style="width:100%;background-color:#FEF3E2;border-radius:12px;overflow:hidden;margin:16px 0;">
          ${changeRows}
        </table>`
      : "";

    const html = emailWrapper(`
      <h2 style="margin:0 0 6px;font-size:22px;color:#2C2416;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${s.title}</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B6157;line-height:1.6;">${s.body}</p>

      ${changesTable}

      ${sectionTitle(s.updatedInfo)}
      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        infoRow(l.guests, l.guestUnit(data.guestCount))
      )}

      ${primaryButton(s.button, `${siteUrl}/reservations`)}

      <p style="font-size:13px;color:#9C9588;margin:20px 0 0;text-align:center;line-height:1.5;">${s.footer}</p>
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
      <h2 style="margin:0 0 6px;font-size:22px;color:#2C2416;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${s.title}</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B6157;line-height:1.6;">${s.body}</p>

      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        infoRow(l.guests, l.guestUnit(data.guestCount)) +
        infoRow(l.status, badge(l.cancelled, 'red'))
      )}

      ${data.cancelReason ? `
        <div style="background-color:#FDE8E8;border-radius:12px;padding:14px 16px;margin:16px 0;">
          <p style="margin:0;font-size:13px;color:#C4453A;line-height:1.5;"><strong>${s.cancelReason}:</strong> ${data.cancelReason}</p>
        </div>
      ` : ""}

      ${willRefund ? `
        <p style="font-size:14px;color:#6B6157;margin:16px 0;line-height:1.5;">
          ${s.refundNote(data.depositAmount)}
        </p>
      ` : ""}

      ${primaryButton(s.button, `${siteUrl}/booking/date`)}

      ${divider()}
      <p style="font-size:13px;color:#9C9588;margin:0;text-align:center;line-height:1.6;">
        ${s.contact}<br/>
        中文: (516) 272-9999 &nbsp;&bull;&nbsp; English: (917) 502-0445
      </p>
    `, { lang, type: "transactional", siteUrl });

    await client.emails.send({ from: emailFrom, to, subject: s.subject, html });
    return { success: true };
  } catch (error) {
    console.error("[email] sendReservationCancelled failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ── 8. Deposit Refunded ────────────────────────────────────────────

interface DepositRefundedData {
  date: string | Date;
  yurtName: string;
  guestCount: number;
  depositAmount: number;
  siteUrl?: string;
}

export async function sendDepositRefunded(
  to: string,
  data: DepositRefundedData
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();
  const lang = await getUserLang(to);
  const s = emailStrings.depositRefunded[lang];
  const l = emailStrings.labels[lang];

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobos.farm";

    const html = emailWrapper(`
      <h2 style="margin:0 0 6px;font-size:22px;color:#2C2416;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${s.title}</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B6157;line-height:1.6;">${s.body}</p>

      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        infoRow(l.guests, l.guestUnit(data.guestCount)) +
        infoRow(l.deposit, `$${data.depositAmount}`) +
        infoRow(l.status, badge(lang === 'zh' ? '已退款' : 'Refunded', 'blue'))
      )}

      ${primaryButton(s.button, `${siteUrl}/reservations`)}

      <p style="font-size:13px;color:#9C9588;margin:20px 0 0;text-align:center;line-height:1.5;">${s.footer}</p>
    `, { lang, type: "transactional", siteUrl });

    await client.emails.send({ from: emailFrom, to, subject: s.subject, html });
    return { success: true };
  } catch (error) {
    console.error("[email] sendDepositRefunded failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ── 9. Pre-order Reminder ──────────────────────────────────────────

interface OrderItemSummary {
  name: string;
  quantity: number;
  price: number;
}

interface PreOrderReminderData {
  date: string | Date;
  yurtName: string;
  guestCount: number;
  reservationId: string;
  orderStatus: "NONE" | "DRAFT" | "SUBMITTED";
  orderItems: OrderItemSummary[];
  estimatedTotal: number;
  siteUrl?: string;
}

export async function sendPreOrderReminder(
  to: string,
  data: PreOrderReminderData
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();
  const lang = await getUserLang(to);
  const s = emailStrings.preOrderReminder[lang];
  const l = emailStrings.labels[lang];

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobos.farm";

    // Reservation info section
    const reservationSection = `
      ${sectionTitle(s.reservationInfo)}
      ${infoTable(
        infoRow(l.date, formatDate(data.date, lang)) +
        infoRow(l.yurt, data.yurtName) +
        infoRow(l.guests, l.guestUnit(data.guestCount))
      )}
    `;

    // Order section
    let orderSection = "";
    if (data.orderStatus === "NONE") {
      orderSection = `
        ${sectionTitle(s.orderSection)}
        <div style="background-color:#FAFAF8;border-radius:12px;padding:20px;text-align:center;">
          <p style="font-size:14px;color:#9C9588;margin:0;">${s.noOrder}</p>
        </div>
      `;
    } else {
      const statusMsg = data.orderStatus === "DRAFT" ? s.draftOrder : s.submittedOrder;
      const itemRows = data.orderItems.map(item =>
        `<tr>
          <td style="padding:8px 0;font-size:13px;color:#2C2416;border-bottom:1px solid #F0EDE8;">${item.name}</td>
          <td style="padding:8px 8px;font-size:13px;color:#6B6157;border-bottom:1px solid #F0EDE8;text-align:center;">&times;${item.quantity}</td>
          <td style="padding:8px 0;font-size:13px;color:#2C2416;border-bottom:1px solid #F0EDE8;text-align:right;">$${(item.price * item.quantity).toFixed(0)}</td>
        </tr>`
      ).join("");

      orderSection = `
        ${sectionTitle(s.orderSection)}
        <p style="font-size:13px;color:#9C9588;margin:0 0 12px;">${statusMsg}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:8px 0;font-size:11px;color:#9C9588;text-align:left;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #E8ECE4;">${s.itemHeader}</th>
              <th style="padding:8px 8px;font-size:11px;color:#9C9588;text-align:center;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #E8ECE4;">${s.qtyHeader}</th>
              <th style="padding:8px 0;font-size:11px;color:#9C9588;text-align:right;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #E8ECE4;">$</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding:12px 0 0;font-size:15px;font-weight:700;color:#2C2416;">${s.subtotal}</td>
              <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#2C2416;text-align:right;">$${data.estimatedTotal.toFixed(0)}</td>
            </tr>
          </tfoot>
        </table>
      `;
    }

    const modifyNote = data.orderStatus === "SUBMITTED"
      ? `<p style="font-size:12px;color:#9C9588;margin:12px 0 0;text-align:center;">${s.modifyNote}</p>`
      : "";

    const html = emailWrapper(`
      <h2 style="margin:0 0 6px;font-size:22px;color:#2C2416;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${s.title}</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#6B6157;line-height:1.6;">${s.body}</p>

      ${reservationSection}
      ${orderSection}
      ${modifyNote}

      ${primaryButton(s.button, `${siteUrl}/pre-order?reservationId=${data.reservationId}`)}

      <p style="font-size:13px;color:#9C9588;margin:20px 0 0;text-align:center;line-height:1.5;">${s.footer}</p>
    `, { lang, type: "transactional", siteUrl });

    await client.emails.send({ from: emailFrom, to, subject: s.subject, html });
    return { success: true };
  } catch (error) {
    console.error("[email] sendPreOrderReminder failed:", error);
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
