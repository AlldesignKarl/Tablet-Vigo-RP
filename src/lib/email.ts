import 'server-only';
import { serverEnv } from '@/lib/env';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Envía el código de acceso policial al correo del dueño del servidor
 * (nunca al ciudadano que lo solicita). Usa la API HTTP de Resend
 * directamente para no añadir un SDK extra; falla en silencio en el
 * negocio si el email no llega, pero el resultado se reporta al llamador
 * para que la API pueda avisar de que el envío falló.
 */
export async function sendPoliceAccessCodeEmail(
  code: string,
  requesterName: string,
): Promise<{ sent: boolean; error?: string }> {
  const { resendApiKey, policeCodeEmail } = serverEnv;

  if (!resendApiKey || !policeCodeEmail) {
    console.error('[police-email] faltan RESEND_API_KEY o POLICE_CODE_EMAIL');
    return { sent: false, error: 'El envío de emails no está configurado en el servidor.' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vigo RP <onboarding@resend.dev>',
        to: [policeCodeEmail],
        subject: `Código de acceso policial: ${code}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px;">
            <p><strong>${escapeHtml(requesterName)}</strong> ha solicitado acceso a la cuenta de policía en la tablet de Vigo RP.</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0;">${code}</p>
            <p style="color: #666; font-size: 13px;">Este código caduca en 10 minutos y solo sirve una vez. No lo compartas con nadie que no debas autorizar como policía.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[police-email] Resend respondió con error', res.status, text);
      return { sent: false, error: `El servicio de email respondió con un error (${res.status}).` };
    }

    return { sent: true };
  } catch (err) {
    console.error('[police-email] fallo al contactar con Resend', err);
    return { sent: false, error: 'No se pudo contactar con el servicio de email.' };
  }
}
