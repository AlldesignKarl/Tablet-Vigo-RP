import 'server-only';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export type DiscordChannelKey =
  | 'webhook_dni'
  | 'webhook_vehiculos'
  | 'webhook_compras'
  | 'webhook_policia'
  | 'webhook_sueldos';

interface DiscordLogInput {
  channel: DiscordChannelKey;
  title: string;
  description: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

/**
 * Envía un log a Discord mediante un webhook configurado desde el
 * panel de administración (tabla app_config, clave "discord").
 * El token/URL del webhook NUNCA se expone al frontend: esta función
 * solo se ejecuta en servidor y lee la URL con la service role key.
 *
 * Es "best effort": si Discord falla o no hay webhook configurado, la
 * acción de negocio que la originó NO debe fallar por ello.
 */
export async function sendDiscordLog(input: DiscordLogInput): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();
    const { data } = await admin.from('app_config').select('value').eq('key', 'discord').single();
    const webhookUrl = (data?.value as Record<string, string | null> | undefined)?.[input.channel];

    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: input.title,
            description: input.description,
            color: input.color ?? 0x2f8bf5,
            fields: input.fields,
            timestamp: new Date().toISOString(),
            footer: { text: 'Vigo RP · Sistema Administrativo' },
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[discord-log] fallo al enviar webhook', err);
  }
}
