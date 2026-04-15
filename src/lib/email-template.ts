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

  const langSwitchLine = `<a href="${settingsUrl}" style="color:#6B7F5E;text-decoration:none;border-bottom:1px solid #6B7F5E;">${langHint[lang]}</a>`;

  const unsubscribeLine =
    type === "marketing" && unsubUrl
      ? `<br/><a href="${unsubUrl}" style="color:#9C9588;text-decoration:underline;font-size:11px;">${lang === "en" ? "Unsubscribe" : "退订"}</a>`
      : "";

  return `<!DOCTYPE html>
<html lang="${lang === "zh" ? "zh" : "en"}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F5F3EF;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F3EF;">
<tr><td align="center" style="padding:40px 16px;">

<!-- Outer card -->
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

  <!-- Logo -->
  <tr>
    <td align="center" style="padding-bottom:24px;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#2C2416;letter-spacing:0.5px;">
            Bobo&#8217;s Farm
          </td>
        </tr>
        <tr>
          <td align="center" style="font-family:Georgia,'Times New Roman',serif;font-size:12px;color:#9C9588;letter-spacing:2px;padding-top:2px;">
            &#27874;&#22992;&#20892;&#23478;&#20048;
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Main card -->
  <tr>
    <td>
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <!-- Accent bar -->
        <tr><td style="height:3px;background:linear-gradient(90deg,#6B7F5E,#8B9E7A,#6B7F5E);"></td></tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 32px;">
            ${body}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:28px 16px 0;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:#9C9588;line-height:1.6;">
        891 Albany Post Rd, New Paltz, NY 12561
      </p>
      <p style="margin:0 0 12px;font-size:11px;color:#B8B2A8;">
        ${lang === "en" ? "This is an automated message. Please do not reply directly." : "此邮件为系统自动发送，请勿直接回复。"}
      </p>
      <p style="margin:0;font-size:11px;color:#B8B2A8;">
        ${langSwitchLine}
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
    <td style="padding:10px 16px;font-size:13px;color:#9C9588;white-space:nowrap;vertical-align:top;border-bottom:1px solid #F5F3EF;">${label}</td>
    <td style="padding:10px 16px;font-size:14px;color:#2C2416;font-weight:600;border-bottom:1px solid #F5F3EF;">${value}</td>
  </tr>`;
}

export function infoTable(rows: string): string {
  return `<table cellpadding="0" cellspacing="0" style="width:100%;background-color:#FAFAF8;border-radius:12px;overflow:hidden;margin:20px 0;">
    ${rows}
  </table>`;
}

export function primaryButton(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 4px;">
    <tr><td align="center">
      <a href="${href}" style="display:inline-block;background-color:#6B7F5E;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:14px 36px;border-radius:100px;letter-spacing:0.3px;">
        ${text}
      </a>
    </td></tr>
  </table>`;
}

export function sectionTitle(text: string): string {
  return `<p style="margin:24px 0 8px;font-size:11px;font-weight:700;color:#9C9588;text-transform:uppercase;letter-spacing:1.5px;">${text}</p>`;
}

export function divider(): string {
  return `<hr style="border:none;border-top:1px solid #F0EDE8;margin:24px 0;" />`;
}

export function badge(text: string, color: string): string {
  const colors: Record<string, { bg: string; text: string }> = {
    green: { bg: '#E8F0E4', text: '#4A7C59' },
    amber: { bg: '#FEF3E2', text: '#B8860B' },
    red: { bg: '#FDE8E8', text: '#C4453A' },
    blue: { bg: '#E8F0FA', text: '#2980B9' },
    gray: { bg: '#F0EDE8', text: '#6B6157' },
  };
  const c = colors[color] || colors.gray;
  return `<span style="display:inline-block;background-color:${c.bg};color:${c.text};font-size:12px;font-weight:700;padding:4px 12px;border-radius:100px;letter-spacing:0.3px;">${text}</span>`;
}
