function readEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

/**
 * Variables públicas: se exponen al navegador (prefijo NEXT_PUBLIC_).
 * Nunca añadas aquí una clave secreta.
 */
export const publicEnv = {
  supabaseUrl: readEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  siteUrl: readEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000'),
};

/**
 * Variables privadas: solo deben leerse en código de servidor
 * (Route Handlers, Server Actions, Server Components). Si este módulo
 * se importa accidentalmente en un componente cliente, Next.js fallará
 * en build porque estas variables no llevan NEXT_PUBLIC_.
 */
export const serverEnv = {
  supabaseServiceRoleKey: readEnv('SUPABASE_SERVICE_ROLE_KEY'),
  discordBotToken: readEnv('DISCORD_BOT_TOKEN'),
  cronSecret: readEnv('CRON_SECRET'),
  resendApiKey: readEnv('RESEND_API_KEY'),
  policeCodeEmail: readEnv('POLICE_CODE_EMAIL'),
};

export function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('Este módulo solo puede usarse en el servidor.');
  }
}
