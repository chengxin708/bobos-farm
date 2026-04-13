import { Resend } from "resend";
import { prisma } from "./prisma";

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
  return `${name} <onboarding@resend.dev>`;
}

// ── Shared HTML helpers ─────────────────────────────────────────────

function emailWrapper(body: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F8F7F4;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F7F4;">
<tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E8ECE4;">
  <!-- Header -->
  <tr>
    <td style="background-color:#1A1208;padding:24px 32px;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:bold;color:#FFF8F0;font-family:Georgia,'Times New Roman',serif;">
        Bobo's Farm
      </h1>
      <p style="margin:4px 0 0;font-size:13px;color:#6B7F5E;">波姐农家乐</p>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="padding:32px;">
      ${body}
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="padding:20px 32px;background-color:#F8F7F4;text-align:center;border-top:1px solid #E8ECE4;">
      <p style="margin:0;font-size:11px;color:#8A7E6B;">
        Bobo's Farm &mdash; Hudson Valley, NY<br/>
        This is an automated message. Please do not reply directly.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;font-size:13px;color:#8A7E6B;white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:8px 12px;font-size:14px;color:#3D2B1F;font-weight:600;">${value}</td>
  </tr>`;
}

function infoTable(rows: string): string {
  return `<table cellpadding="0" cellspacing="0" style="width:100%;background-color:#F8F7F4;border-radius:8px;border:1px solid #E8ECE4;margin:16px 0;">
    ${rows}
  </table>`;
}

function primaryButton(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background-color:#6B7F5E;border-radius:8px;padding:12px 28px;text-align:center;">
      <a href="${href}" style="color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;">${text}</a>
    </td></tr>
  </table>`;
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
  if (!client) {
    return { success: false, error: "API key not configured" };
  }
  const emailFrom = await getEmailFrom();

  try {
    const deadlineStr = data.paymentDeadline
      ? formatDate(data.paymentDeadline)
      : "N/A";

    const paymentInfo = data.zelleRecipient
      ? `<p style="font-size:13px;color:#3D2B1F;margin:12px 0 4px;">
          <strong>Zelle 收款信息:</strong><br/>
          收款人: ${data.zelleRecipientName || data.zelleRecipient}<br/>
          Zelle: ${data.zelleRecipient}
          ${data.memoCode ? `<br/>备注码: <strong style="color:#8B6914;">${data.memoCode}</strong>` : ""}
        </p>`
      : "";

    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobosfarm.com";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#3D2B1F;">预订已创建</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#5A5A5A;">
        您的预订已成功创建，请在截止时间前完成付款。
      </p>

      ${infoTable(
        infoRow("预订日期", formatDate(data.date)) +
        infoRow("营地", data.yurtName) +
        infoRow("人数", `${data.guestCount} 人`) +
        infoRow("定金金额", `$${data.depositAmount}`) +
        infoRow("付款截止", deadlineStr)
      )}

      ${paymentInfo}

      <p style="font-size:13px;color:#C4533A;margin:16px 0 0;">
        请在截止时间前通过 Zelle 支付定金，逾期预订将自动取消。
      </p>

      ${primaryButton("查看我的预订", `${siteUrl}/reservations`)}
    `);

    await client.emails.send({
      from: emailFrom,
      to,
      subject: "Bobo's Farm — 预订已创建",
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("[email] sendReservationCreated failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
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
  if (!client) {
    return { success: false, error: "API key not configured" };
  }
  const emailFrom = await getEmailFrom();

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobosfarm.com";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#3D2B1F;">定金已确认</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#5A5A5A;">
        您的定金已确认，预订正式生效！您可以提前预点菜品。
      </p>

      ${infoTable(
        infoRow("预订日期", formatDate(data.date)) +
        infoRow("营地", data.yurtName) +
        infoRow("人数", `${data.guestCount} 人`) +
        infoRow("状态", '<span style="color:#4A7C59;font-weight:bold;">已确认</span>')
      )}

      ${primaryButton("预点菜品", `${siteUrl}/pre-order?reservationId=${data.reservationId}`)}

      <p style="font-size:13px;color:#5A5A5A;margin:16px 0 0;">
        如有任何问题，请通过网站联系我们。期待您的到来！
      </p>
    `);

    await client.emails.send({
      from: emailFrom,
      to,
      subject: "Bobo's Farm — 定金已确认",
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("[email] sendDepositConfirmed failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
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
  if (!client) {
    return { success: false, error: "API key not configured" };
  }
  const emailFrom = await getEmailFrom();

  try {
    const deadlineStr = data.paymentDeadline
      ? formatDate(data.paymentDeadline)
      : "即将到期";

    const remainingHours = data.paymentDeadline
      ? Math.max(0, Math.round((new Date(data.paymentDeadline).getTime() - Date.now()) / 3600000))
      : 0;

    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobosfarm.com";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#C4533A;">付款提醒</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#5A5A5A;">
        您的预订定金尚未支付，请尽快完成付款以保留预订。
      </p>

      <div style="background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;font-size:14px;color:#C4533A;font-weight:bold;">
          剩余时间: ${remainingHours} 小时
        </p>
        <p style="margin:4px 0 0;font-size:12px;color:#991B1B;">
          截止时间: ${deadlineStr}
        </p>
      </div>

      ${infoTable(
        infoRow("预订日期", formatDate(data.date)) +
        infoRow("营地", data.yurtName) +
        infoRow("定金金额", `$${data.depositAmount}`)
      )}

      ${data.zelleRecipient
        ? `<p style="font-size:13px;color:#3D2B1F;margin:12px 0 4px;">
            <strong>Zelle 收款信息:</strong><br/>
            收款人: ${data.zelleRecipientName || data.zelleRecipient}<br/>
            Zelle: ${data.zelleRecipient}
            ${data.memoCode ? `<br/>备注码: <strong style="color:#8B6914;">${data.memoCode}</strong>` : ""}
          </p>`
        : ""
      }

      ${primaryButton("立即付款", `${siteUrl}/reservations`)}

      <p style="font-size:12px;color:#C4533A;margin:16px 0 0;">
        逾期未付款，预订将自动取消。
      </p>
    `);

    await client.emails.send({
      from: emailFrom,
      to,
      subject: "Bobo's Farm — 付款提醒",
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("[email] sendPaymentReminder failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
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
  if (!client) {
    return { success: false, error: "API key not configured" };
  }
  const emailFrom = await getEmailFrom();

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobosfarm.com";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#3D2B1F;">新预订通知</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#5A5A5A;">
        有新的预订需要关注。
      </p>

      ${infoTable(
        infoRow("客人", data.guestName) +
        infoRow("预订日期", formatDate(data.date)) +
        infoRow("营地", data.yurtName) +
        infoRow("人数", `${data.guestCount} 人`)
      )}

      ${primaryButton("查看仪表盘", `${siteUrl}/admin/dashboard`)}
    `);

    await client.emails.send({
      from: emailFrom,
      to,
      subject: "新预订通知",
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("[email] sendAdminNewReservation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
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
  if (!client) {
    return { success: false, error: "API key not configured" };
  }
  const emailFrom = await getEmailFrom();

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobosfarm.com";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#8B6914;">定金待确认</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#5A5A5A;">
        有客人已提交定金付款凭证，请及时确认。
      </p>

      ${infoTable(
        infoRow("客人", data.guestName) +
        infoRow("预订日期", formatDate(data.date)) +
        infoRow("营地", data.yurtName) +
        infoRow("人数", `${data.guestCount} 人`) +
        infoRow("定金金额", `$${data.depositAmount}`)
      )}

      ${primaryButton("前往确认定金", `${siteUrl}/admin/reservations?view=deposits`)}
    `);

    await client.emails.send({
      from: emailFrom,
      to,
      subject: "定金待确认",
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("[email] sendAdminDepositSubmitted failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ── 6. Yurt Assigned (通知客户蒙古包已分配) ────────────────────────────

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

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobosfarm.com";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#3D2B1F;">蒙古包已分配</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#5A5A5A;">
        您的蒙古包已由我们的团队分配，请查看以下详情。
      </p>

      ${infoTable(
        infoRow("预订日期", formatDate(data.date)) +
        infoRow("蒙古包", data.yurtName) +
        (data.yurtDescription ? infoRow("描述", data.yurtDescription) : "") +
        infoRow("人数", `${data.guestCount} 人`)
      )}

      ${primaryButton("查看预订详情", `${siteUrl}/reservations`)}

      <p style="font-size:13px;color:#5A5A5A;margin:16px 0 0;">
        如有任何问题，请联系我们。期待您的到来！
      </p>
    `);

    await client.emails.send({
      from: emailFrom,
      to,
      subject: "Bobo's Farm — 蒙古包已分配",
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("[email] sendYurtAssigned failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ── 7. Reservation Modified (通知客户预订已更新) ──────────────────────

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

  try {
    const siteUrl =
      data.siteUrl || process.env.NEXTAUTH_URL || "https://bobosfarm.com";

    // Build change rows
    let changeRows = "";
    if (data.changes.date) {
      changeRows += `<tr>
        <td style="padding:6px 12px;font-size:13px;color:#8A7E6B;">日期</td>
        <td style="padding:6px 12px;font-size:14px;color:#3D2B1F;">
          <span style="text-decoration:line-through;color:#8A7E6B;">${formatDate(data.changes.date.from)}</span>
          &nbsp;&rarr;&nbsp;
          <strong>${formatDate(data.changes.date.to)}</strong>
        </td>
      </tr>`;
    }
    if (data.changes.yurt) {
      changeRows += `<tr>
        <td style="padding:6px 12px;font-size:13px;color:#8A7E6B;">蒙古包</td>
        <td style="padding:6px 12px;font-size:14px;color:#3D2B1F;">
          <span style="text-decoration:line-through;color:#8A7E6B;">${data.changes.yurt.from}</span>
          &nbsp;&rarr;&nbsp;
          <strong>${data.changes.yurt.to}</strong>
        </td>
      </tr>`;
    }
    if (data.changes.guestCount) {
      changeRows += `<tr>
        <td style="padding:6px 12px;font-size:13px;color:#8A7E6B;">人数</td>
        <td style="padding:6px 12px;font-size:14px;color:#3D2B1F;">
          <span style="text-decoration:line-through;color:#8A7E6B;">${data.changes.guestCount.from} 人</span>
          &nbsp;&rarr;&nbsp;
          <strong>${data.changes.guestCount.to} 人</strong>
        </td>
      </tr>`;
    }

    const changesTable = changeRows
      ? `<table cellpadding="0" cellspacing="0" style="width:100%;background-color:#FFF8E1;border-radius:8px;border:1px solid #E8D5A3;margin:16px 0;">
          ${changeRows}
        </table>`
      : "";

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#3D2B1F;">预订已更新</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#5A5A5A;">
        您的预订信息已更新，请查看以下变更：
      </p>

      ${changesTable}

      <p style="margin:16px 0 8px;font-size:14px;color:#3D2B1F;font-weight:bold;">更新后的预订信息：</p>
      ${infoTable(
        infoRow("预订日期", formatDate(data.date)) +
        infoRow("营地", data.yurtName) +
        infoRow("人数", `${data.guestCount} 人`)
      )}

      ${primaryButton("查看我的预订", `${siteUrl}/reservations`)}

      <p style="font-size:13px;color:#5A5A5A;margin:16px 0 0;">
        如有任何问题，请联系我们。期待您的到来！
      </p>
    `);

    await client.emails.send({
      from: emailFrom,
      to,
      subject: "Bobo's Farm — 预订已更新",
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("[email] sendReservationModified failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ── 8. Reservation Cancelled (通知客户) ─────────────────────────────

interface ReservationCancelledData {
  date: string | Date;
  yurtName: string;
  guestCount: number;
  cancelReason?: string;
  depositAmount: number;
  depositStatus: string; // CONFIRMED → 会退款; UNPAID/PENDING → 不退
  siteUrl?: string;
}

export async function sendReservationCancelled(
  to: string,
  data: ReservationCancelledData
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();

  try {
    const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobosfarm.com";
    const willRefund = data.depositStatus === 'CONFIRMED';

    const html = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#DC3545;">预订已取消</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#5A5A5A;">
        很遗憾，您的预订已被取消。
      </p>

      ${infoTable(
        infoRow("预订日期", formatDate(data.date)) +
        infoRow("营地", data.yurtName) +
        infoRow("人数", `${data.guestCount} 人`) +
        infoRow("状态", '<span style="color:#DC3545;font-weight:bold;">已取消</span>')
      )}

      ${data.cancelReason ? `
        <div style="background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;font-size:13px;color:#991B1B;"><strong>取消原因:</strong> ${data.cancelReason}</p>
        </div>
      ` : ''}

      ${willRefund ? `
        <p style="font-size:14px;color:#5A5A5A;margin:16px 0;">
          您已支付的定金 <strong>$${data.depositAmount}</strong> 将按照退款政策处理。
        </p>
      ` : ''}

      ${primaryButton("重新预订", `${siteUrl}/booking/date`)}

      <p style="font-size:13px;color:#5A5A5A;margin:16px 0 0;">
        如有任何疑问，请联系我们：<br/>
        中文: (516) 272-9999 &nbsp;|&nbsp; English: (917) 502-0445
      </p>
    `);

    await client.emails.send({
      from: emailFrom,
      to,
      subject: "Bobo's Farm — 预订已取消",
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("[email] sendReservationCancelled failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
