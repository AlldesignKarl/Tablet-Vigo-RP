import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { purchaseProductSchema } from '@/lib/validation';
import { sendDiscordLog } from '@/lib/discord';
import { enforceRateLimit } from '@/lib/rate-limit';

export const POST = withErrorHandling(async (req) => {
  const { supabase, user } = await requireUser();
  await enforceRateLimit(supabase, `purchase:${user.id}`, 30, 300);
  const body = purchaseProductSchema.parse(await req.json());

  const { data, error } = await supabase.rpc('purchase_product', { p_product_id: body.productId });
  if (error) throw new ApiError(400, error.message);

  const result = data?.[0];
  if (!result) throw new ApiError(500, 'Respuesta inesperada del servidor.');
  if (!result.success) throw new ApiError(400, result.message);

  await sendDiscordLog({
    channel: 'webhook_compras',
    title: '🛒 Compra realizada',
    description: 'Un ciudadano ha realizado una compra en la tienda.',
  });

  return jsonOk(result);
});
