"""
Envio de e-mail via SMTP para entregar chaves de licença ao cliente.

Variáveis de ambiente necessárias:
  SMTP_HOST      - ex: smtp.gmail.com
  SMTP_PORT      - ex: 587
  SMTP_USER      - e-mail remetente
  SMTP_PASSWORD  - senha ou App Password do Gmail
  SMTP_FROM_NAME - nome exibido (padrão: "TradeTracker MT5")
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST      = os.getenv("SMTP_HOST", "")
SMTP_PORT      = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER      = os.getenv("SMTP_USER", "")
SMTP_PASSWORD  = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "TradeTracker MT5")


def _is_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def send_license_key(to_email: str, to_name: str, key: str, transaction_id: str | None = None) -> None:
    """Envia a chave de licença para o e-mail do cliente."""
    if not _is_configured():
        raise RuntimeError("SMTP não configurado. Defina SMTP_HOST, SMTP_USER e SMTP_PASSWORD.")

    subject = "Sua licença TradeTracker MT5 chegou!"

    ref_line = f"<p style='color:#888;font-size:13px;'>Pedido: {transaction_id}</p>" if transaction_id else ""

    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#1e293b;border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#0ea5e9;padding:28px 40px;">
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">
                TradeTracker MT5
              </h1>
              <p style="margin:6px 0 0;color:#e0f2fe;font-size:14px;">
                Sua licença está pronta!
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="color:#cbd5e1;font-size:15px;margin:0 0 24px;">
                Olá, <strong style="color:#f1f5f9;">{to_name}</strong>! 👋<br><br>
                Obrigado pela sua compra. Abaixo está sua chave de ativação do
                <strong>TradeTracker MT5</strong>.
              </p>

              <!-- Key box -->
              <div style="background:#0f172a;border:2px solid #0ea5e9;border-radius:8px;
                          padding:20px;text-align:center;margin:0 0 28px;">
                <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;
                           text-transform:uppercase;letter-spacing:1px;">
                  Chave de Licença
                </p>
                <p style="margin:0;color:#38bdf8;font-size:26px;font-weight:700;
                           letter-spacing:3px;font-family:'Courier New',monospace;">
                  {key}
                </p>
              </div>

              <!-- Instructions -->
              <p style="color:#94a3b8;font-size:14px;margin:0 0 8px;">
                <strong style="color:#cbd5e1;">Como ativar:</strong>
              </p>
              <ol style="color:#94a3b8;font-size:14px;padding-left:20px;margin:0 0 28px;">
                <li style="margin-bottom:6px;">Baixe e instale o TradeTracker MT5 no seu computador.</li>
                <li style="margin-bottom:6px;">Abra o aplicativo — a tela de ativação aparecerá automaticamente.</li>
                <li style="margin-bottom:6px;">Digite ou cole a chave acima e clique em <strong>Ativar licença</strong>.</li>
                <li>Pronto! O app estará liberado para uso neste computador.</li>
              </ol>

              <p style="color:#64748b;font-size:13px;margin:0 0 4px;">
                ⚠️ Esta licença fica vinculada ao computador onde for ativada pela primeira vez.
              </p>
              {ref_line}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0f172a;padding:20px 40px;border-top:1px solid #1e293b;">
              <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
                Dúvidas? Responda este e-mail ou entre em contato com o suporte.<br>
                <strong style="color:#334155;">TecnoHuby — TradeTracker MT5</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
    msg["To"]      = to_email

    # Texto simples como fallback
    plain = (
        f"Olá, {to_name}!\n\n"
        f"Sua chave de licença do TradeTracker MT5:\n\n"
        f"  {key}\n\n"
        f"Para ativar, abra o aplicativo e insira a chave na tela de ativação.\n"
        f"Esta licença fica vinculada ao computador onde for ativada pela primeira vez.\n\n"
        + (f"Pedido: {transaction_id}\n" if transaction_id else "")
        + "\nTecnoHuby — TradeTracker MT5"
    )

    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html,  "html",  "utf-8"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, to_email, msg.as_string())
