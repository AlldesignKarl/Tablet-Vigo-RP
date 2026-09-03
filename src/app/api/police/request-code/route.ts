import { requireUser, ApiError } from '@/lib/auth-helpers';
import { jsonOk, withErrorHandling } from '@/lib/api-helpers';
import { getCitizenProfile } from '@/lib/data/citizen';
import { sendPoliceAccessCodeEmail } from '@/lib/email';

export const POST = withErrorHandling(async () => {
  const { supabase, user } = await requireUser();

  // El código en sí solo existe en la respuesta de esta función de
  // servidor (nunca llega al ciudadano): se genera aquí, en el servidor
  // Next.js, y se envía por email al dueño del servidor, que es quien
  // decide si se lo comunica a la persona que lo pidió.
  const { data, error } = await supabase.rpc('request_police_access_code');
  if (error) throw new ApiError(400, error.message);

  const result = data?.[0];
  if (!result) throw new ApiError(500, 'Respuesta inesperada del servidor.');
  if (!result.success || !result.code) throw new ApiError(403, result.message);

  const profile = await getCitizenProfile(supabase, user.id);
  const requesterName = profile ? `${profile.first_name} ${profile.last_name}` : 'Ciudadano desconocido';

  const emailResult = await sendPoliceAccessCodeEmail(result.code, requesterName);
  if (!emailResult.sent) {
    throw new ApiError(500, emailResult.error ?? 'No se pudo enviar el código por email.');
  }

  return jsonOk({ sent: true });
});
