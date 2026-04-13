export type Lang = "en" | "zh";
export type EmailType = "transactional" | "marketing";

interface WrapperOptions {
  lang: Lang;
  type: EmailType;
  unsubscribeToken?: string;
  siteUrl: string;
}

const langHint: Record<Lang, string> = {
  en: "您可以在网站上更改邮件语言偏好。",
  zh: "You can change your email language preference on our website.",
};

export function emailWrapper(body: string, opts: WrapperOptions): string {
  const { lang, type, unsubscribeToken, siteUrl } = opts;
  const settingsUrl = `${siteUrl}/settings`;
  const unsubUrl = unsubscribeToken
    ? `${siteUrl}/unsubscribe?token=${unsubscribeToken}`
    : null;

  const langSwitchLine = `<a href="${settingsUrl}" style="color:#5B8C3E;text-decoration:underline;">${langHint[lang]}</a>`;

  const unsubscribeLine =
    type === "marketing" && unsubUrl
      ? `<br/><a href="${unsubUrl}" style="color:#8A7E6B;text-decoration:underline;font-size:11px;">${lang === "en" ? "Unsubscribe" : "退订"}</a>`
      : "";

  return `<!DOCTYPE html>
<html lang="${lang === "zh" ? "zh" : "en"}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F8F7F4;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F7F4;">
<tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E8ECE4;">
  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#4A7C59,#5B8C3E);padding:28px 32px;text-align:center;">
      <h1 style="margin:0;font-size:24px;font-weight:bold;color:#FFFFFF;font-family:Georgia,'Times New Roman',serif;">
        Bobo&#8217;s Farm
      </h1>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7);font-family:Georgia,'Times New Roman',serif;">
        &#27874;&#22992;&#20892;&#23478;&#20048;
      </p>
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
      <p style="margin:0 0 10px;font-size:11px;color:#8A7E6B;">
        ${langSwitchLine}
      </p>
      <p style="margin:0;font-size:11px;color:#8A7E6B;">
        Bobo&#8217;s Farm &mdash; 891 Albany Post Rd, New Paltz, NY 12561<br/>
        ${lang === "en" ? "This is an automated message. Please do not reply directly." : "此邮件为系统自动发送，请勿直接回复。"}
        ${unsubscribeLine}
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function formatDate(date: string | Date, lang: Lang): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;font-size:13px;color:#8A7E6B;white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:8px 12px;font-size:14px;color:#3D2B1F;font-weight:600;">${value}</td>
  </tr>`;
}

export function infoTable(rows: string): string {
  return `<table cellpadding="0" cellspacing="0" style="width:100%;background-color:#FFF8F0;border-radius:8px;border-left:4px solid #5B8C3E;margin:16px 0;">
    ${rows}
  </table>`;
}

export function primaryButton(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background-color:#5B8C3E;border-radius:10px;padding:12px 28px;text-align:center;">
      <a href="${href}" style="color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;">${text}</a>
    </td></tr>
  </table>`;
}
