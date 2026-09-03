import 'server-only';

export interface RobloxProfile {
  userId: number;
  username: string;
  avatarUrl: string | null;
}

/**
 * Resuelve un nombre de usuario de Roblox a su UserId y avatar público
 * usando las APIs oficiales de Roblox. Se ejecuta SIEMPRE en el
 * servidor (route handler) para evitar problemas de CORS y para que
 * la lista de usuarios de Roblox nunca dependa del navegador del
 * cliente.
 */
export async function lookupRobloxUser(username: string): Promise<RobloxProfile | null> {
  const userRes = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    cache: 'no-store',
  });

  if (!userRes.ok) {
    throw new Error('No se pudo contactar con la API de Roblox.');
  }

  const userData = (await userRes.json()) as { data: Array<{ id: number; name: string }> };
  const match = userData.data?.[0];
  if (!match) {
    return null;
  }

  let avatarUrl: string | null = null;
  try {
    const avatarRes = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${match.id}&size=420x420&format=Png&isCircular=false`,
      { cache: 'no-store' },
    );
    if (avatarRes.ok) {
      const avatarData = (await avatarRes.json()) as { data: Array<{ imageUrl: string }> };
      avatarUrl = avatarData.data?.[0]?.imageUrl ?? null;
    }
  } catch {
    avatarUrl = null;
  }

  return { userId: match.id, username: match.name, avatarUrl };
}
