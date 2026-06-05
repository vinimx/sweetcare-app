import { Resend } from "resend";
import { logger } from "../logging/logger.js";

let instance: Resend | null = null;

function getResend(): Resend {
  if (!instance) {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    instance = new Resend(apiKey);
  }
  return instance;
}

const RESET_TTL_MINUTES = 60;

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const deepLink = `sweetcare://auth/reset-password?token=${rawToken}`;

  try {
    await getResend().emails.send({
      from: "SweetCare <noreply@sweetcare.app>",
      to: [to],
      subject: "Redefinição de senha — SweetCare",
      html: buildHtml(deepLink),
      text: buildText(deepLink),
    });
  } catch (err) {
    logger.error({ err }, "Resend email delivery failed");
    throw err;
  }
}

function buildHtml(deepLink: string): string {
  return `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px">
  <div style="background:#2563eb;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
    <span style="font-size:32px">🩺</span>
    <h1 style="color:#fff;margin:8px 0 4px;font-size:22px">SweetCare</h1>
    <p style="color:rgba(255,255,255,0.8);margin:0;font-size:14px">Cuidado preciso para crianças com T1DM</p>
  </div>
  <h2 style="color:#1e293b;font-size:18px;margin-bottom:8px">Redefinição de senha</h2>
  <p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:24px">
    Recebemos uma solicitação para redefinir a senha da sua conta.<br>
    Toque no botão abaixo <strong>no seu dispositivo</strong> com o SweetCare instalado.
  </p>
  <a href="${deepLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;margin-bottom:24px">
    Redefinir senha
  </a>
  <p style="color:#94a3b8;font-size:13px;margin:0">
    Este link expira em ${String(RESET_TTL_MINUTES)} minutos.<br>
    Se você não solicitou a redefinição, ignore este e-mail com segurança.
  </p>
</div>`.trim();
}

function buildText(deepLink: string): string {
  return [
    "Redefinição de senha — SweetCare",
    "",
    "Recebemos uma solicitação para redefinir a senha da sua conta.",
    "Abra o link abaixo no dispositivo com o SweetCare instalado:",
    "",
    deepLink,
    "",
    `Este link expira em ${String(RESET_TTL_MINUTES)} minutos.`,
    "Se você não solicitou a redefinição, ignore este e-mail.",
  ].join("\n");
}
