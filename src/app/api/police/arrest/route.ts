import { requirePolice, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { arrestSchema } from '@/lib/validation';
import { sendDiscordLog } from '@/lib/discord';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requirePolice();
  await enforceRateLimit(supabase, `police_action:${user.id}`, 60, 300);
  const body = arrestSchema.parse(await req.json());

  // police_arrest() vuelve a comprobar is_police_authorized() dentro de
  // la propia función de base de datos: aunque alguien manipule este
  // route handler o llame directamente a la API, la base de datos
  // rechazará la operación si no está autorizado.
  const { data, error } = await supabase.rpc('police_arrest', {
    p_citizen_id: body.citizenId,
    p_reason: body.reason,
    p_duration_minutes: body.durationMinutes,
  });
  if (error) throw new ApiError(403, error.message);

  await sendDiscordLog({
    channel: 'webhook_policia',
    title: '🚔 Arresto registrado',
    description: `Motivo: ${body.reason}`,
    fields: [{ name: 'Duración', value: `${body.durationMinutes} min`, inline: true }],
    color: 0xef4444,
  });

  return jsonOk({ id: data }, 201);
});
