import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { purchaseLicenseSchema } from '@/lib/validation';
import { sendDiscordLog } from '@/lib/discord';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requireUser();
  await enforceRateLimit(supabase, `purchase:${user.id}`, 30, 300);
  const body = purchaseLicenseSchema.parse(await req.json());

  // purchase_license() vuelve a comprobar el saldo REAL en la base de
  // datos dentro de una transacción atómica: el cliente nunca decide
  // si tiene fondos suficientes.
  const { data, error } = await supabase.rpc('purchase_license', { p_license_type_id: body.licenseTypeId });
  if (error) throw new ApiError(400, error.message);

  const result = data?.[0];
  if (!result) throw new ApiError(500, 'Respuesta inesperada del servidor.');
  if (!result.success) throw new ApiError(400, result.message);

  await sendDiscordLog({
    channel: 'webhook_compras',
    title: '🪪 Licencia adquirida',
    description: 'Un ciudadano ha adquirido una nueva licencia.',
  });

  return jsonOk(result);
});
