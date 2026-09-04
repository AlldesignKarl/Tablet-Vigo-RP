/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'tr.rbxcdn.com' },
      { protocol: 'https', hostname: '*.rbxcdn.com' },
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
    ],
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Cabeceras de seguridad estándar en todas las respuestas. Esto es lo
  // que realmente frena a un navegador (evita que la tablet se pueda
  // meter en un iframe ajeno, fuerza HTTPS, no expone el referer entero
  // a otros sitios, etc.) — a diferencia de trucos del lado del cliente
  // como bloquear el clic derecho, que un usuario que sepa lo que hace
  // salta sin esfuerzo y por eso no se han añadido aquí.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
