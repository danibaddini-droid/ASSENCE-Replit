import { logger } from "./logger";

interface NewClientNotification {
  clientName: string;
  birthDate: string;
  birthTime?: string | null;
  birthPlace: string;
  clientEmail?: string | null;
  readingId: number;
}

export async function sendNewClientNotification(data: NewClientNotification): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFICATION_EMAIL;

  if (!apiKey || !toEmail) {
    logger.debug("Email notification skipped: RESEND_API_KEY or NOTIFICATION_EMAIL not set");
    return;
  }

  const clientEmailLine = data.clientEmail
    ? `<tr><td style="padding:4px 0;color:#9ca3af;font-size:13px;">E-mail do cliente</td><td style="padding:4px 0 4px 16px;font-size:13px;">${data.clientEmail}</td></tr>`
    : "";

  const birthTimeLine = data.birthTime
    ? `<tr><td style="padding:4px 0;color:#9ca3af;font-size:13px;">Hora de nascimento</td><td style="padding:4px 0 4px 16px;font-size:13px;">${data.birthTime}</td></tr>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#13131a;border:1px solid #2a2a3a;border-radius:16px;overflow:hidden;max-width:560px;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e,#13131a);padding:32px 36px 24px;border-bottom:1px solid #2a2a3a;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#c9950022;border:1px solid #c9950044;border-radius:50%;width:40px;height:40px;text-align:center;vertical-align:middle;font-size:18px;">✦</td>
                <td style="padding-left:12px;font-size:22px;font-weight:600;color:#e8e8f0;letter-spacing:0.5px;">Assence</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 8px;font-size:13px;color:#c99500;font-weight:500;text-transform:uppercase;letter-spacing:1px;">Nova solicitação de mapa</p>
            <h1 style="margin:0 0 24px;font-size:24px;color:#e8e8f0;font-weight:600;">${data.clientName}</h1>
            <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #2a2a3a;border-radius:10px;overflow:hidden;">
              <tr style="background:#1a1a2e;">
                <td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:600;color:#c99500;text-transform:uppercase;letter-spacing:1px;">Dados de nascimento</td>
              </tr>
              <tr style="background:#13131a;">
                <td style="padding:12px 16px;" colspan="2">
                  <table cellpadding="0" cellspacing="0">
                    <tr><td style="padding:4px 0;color:#9ca3af;font-size:13px;">Data de nascimento</td><td style="padding:4px 0 4px 16px;font-size:13px;color:#e8e8f0;">${data.birthDate}</td></tr>
                    ${birthTimeLine}
                    <tr><td style="padding:4px 0;color:#9ca3af;font-size:13px;">Cidade</td><td style="padding:4px 0 4px 16px;font-size:13px;color:#e8e8f0;">${data.birthPlace}</td></tr>
                    ${clientEmailLine}
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
              O cálculo do mapa natal e a análise já foram iniciados automaticamente.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #2a2a3a;text-align:center;">
            <p style="margin:0;font-size:11px;color:#4b5563;font-style:italic;">"As estrelas inclinam, não obrigam."</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Assence <notificacoes@assence.app>",
        to: [toEmail],
        subject: `Nova solicitação de mapa — ${data.clientName}`,
        html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.warn({ status: response.status, body: text }, "Resend email failed");
    } else {
      logger.info({ clientName: data.clientName }, "New client notification email sent");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to send new client notification email");
  }
}
