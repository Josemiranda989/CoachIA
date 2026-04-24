import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }
  return new Resend(apiKey);
}

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

type ResetEmailParams = {
  to: string;
  resetUrl: string;
  userName?: string | null;
};

export async function sendPasswordResetEmail({ to, resetUrl, userName }: ResetEmailParams) {
  const resend = getClient();
  const name = userName || "Atleta";

  const html = buildResetPasswordHtml({ name, resetUrl });
  const text = buildResetPasswordText({ name, resetUrl });

  const result = await resend.emails.send({
    from: FROM,
    to,
    subject: "Recuperar contraseña — CoachIA",
    html,
    text,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  return result.data;
}

function buildResetPasswordText({ name, resetUrl }: { name: string; resetUrl: string }) {
  return `Hola ${name},

Recibimos una solicitud para restablecer tu contraseña en CoachIA.

Abrí este link para elegir una nueva contraseña:
${resetUrl}

El link expira en 1 hora.

Si no pediste este cambio, ignorá este email — tu contraseña seguirá igual.

— CoachIA`;
}

function buildResetPasswordHtml({ name, resetUrl }: { name: string; resetUrl: string }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Recuperar contraseña — CoachIA</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5e5e5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#141414;border:1px solid #262626;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px 32px;border-bottom:1px solid #262626;">
              <div style="font-size:28px;font-weight:900;letter-spacing:-0.04em;">
                <span style="color:#fff;">Coach</span><span style="color:#dc2626;">IA</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#fff;">Hola ${name},</h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#d4d4d4;">
                Recibimos una solicitud para restablecer tu contraseña en CoachIA. Hacé click en el botón de abajo para elegir una nueva.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:#dc2626;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
                  Restablecer contraseña
                </a>
              </div>
              <p style="margin:0 0 16px 0;font-size:13px;line-height:1.6;color:#a3a3a3;">
                O copiá y pegá este link en tu navegador:
              </p>
              <p style="margin:0 0 24px 0;font-size:12px;line-height:1.5;word-break:break-all;color:#737373;">
                ${resetUrl}
              </p>
              <div style="padding:16px;background:#1f1f1f;border:1px solid #333;border-radius:8px;margin:24px 0;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:#d4d4d4;">
                  ⏱️ El link expira en <strong>1 hora</strong>.
                </p>
              </div>
              <p style="margin:24px 0 0 0;font-size:13px;line-height:1.5;color:#a3a3a3;">
                Si no pediste este cambio, ignorá este email — tu contraseña seguirá igual.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #262626;text-align:center;">
              <p style="margin:0;font-size:12px;color:#737373;">
                CoachIA — Tu coach digital
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
