import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { createDniSchema } from '@/lib/validation';
import { lookupRobloxUser } from '@/lib/roblox';
import { sendDiscordLog } from '@/lib/discord';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requireUser();
  await enforceRateLimit(supabase, `dni_create:${user.id}`, 5, 3600);

  const { data: existing } = await supabase.from('dnis').select('id').eq('profile_id', user.id).maybeSingle();
  if (existing) {
    throw new ApiError(409, 'Ya tienes un DNI creado.');
  }

  const body = createDniSchema.parse(await req.json());

  // El avatar/UserId de Roblox se resuelve SIEMPRE en servidor, nunca
  // se acepta el que pudiera mandar el cliente.
  const roblox = await lookupRobloxUser(body.robloxUsername);
  if (!roblox) {
    throw new ApiError(404, 'Usuario de Roblox no encontrado');
  }

  const { data: dni, error } = await supabase
    .from('dnis')
    .insert({
      profile_id: user.id,
      first_name: body.firstName,
      last_name: body.lastName,
      birth_date: body.birthDate,
      roblox_username: roblox.username,
      roblox_user_id: roblox.userId,
      roblox_avatar_url: roblox.avatarUrl,
    })
    .select('*')
    .single();

  if (error || !dni) {
    throw new ApiError(400, 'No se pudo crear el DNI. Puede que ya tengas uno.');
  }

  await sendDiscordLog({
    channel: 'webhook_dni',
    title: '🪪 Nuevo DNI creado',
    description: `**${dni.first_name} ${dni.last_name}** (${dni.dni_number}) se ha registrado en Vigo RP.`,
    fields: [{ name: 'Usuario Roblox', value: dni.roblox_username, inline: true }],
  });

  return jsonOk(dni, 201);
});
