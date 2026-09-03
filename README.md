# 🛡️ Vigo RP — Tablet Policial y Administrativa

Aplicación web completa (frontend + backend + base de datos) para la tablet
policial/administrativa del servidor de Roblox ERLC **Spanish Vigo
Roleplay**. Incluye DNI con avatar de Roblox, banco con sueldos
automáticos cada 48h, tienda y licencias, registro de vehículos, panel
policial con acciones reales (arrestos, multas, incautaciones, puntos,
busca y captura), radio en tiempo real, integración con Discord, panel de
administración y auditoría completa.

## Tecnologías

- **Frontend/Backend**: Next.js 14 (App Router) + TypeScript + Route Handlers
- **Estilos**: Tailwind CSS
- **Base de datos y Auth**: Supabase (PostgreSQL + Supabase Auth con Discord OAuth + Realtime)
- **Validación**: Zod
- **Hosting recomendado**: Vercel (plan gratuito)

Toda la lógica sensible (dinero, acciones policiales, permisos) vive en
**funciones de PostgreSQL `SECURITY DEFINER`** (ver `supabase/migrations`),
protegidas además por **Row Level Security**. El frontend nunca decide si
un usuario tiene saldo suficiente o permisos de policía: siempre se
verifica en el servidor/base de datos.

## Estructura del proyecto

```
src/
  app/                 Páginas (App Router) y Route Handlers (API)
    api/                 Endpoints REST (roblox, dni, banco, tienda, vehículos, policía, admin, cron)
    tablet/              Tablet del ciudadano (DNI, banco, vehículos, tienda, historial, policía)
    admin/               Panel de administración
    login/, onboarding/, auth/callback/
  components/          Componentes de React organizados por dominio
    dni/, bank/, shop/, vehicles/, police/, admin/, tablet/, boot/, ui/
  lib/                 Lógica compartida de servidor/cliente
    supabase/            Clientes de Supabase (browser, server, admin/service-role)
    roblox.ts            Proxy de la API de Roblox (solo servidor)
    discord.ts           Envío de logs a Discord vía webhook
    auth-helpers.ts       requireUser/requirePolice/requireAdmin
    validation.ts         Esquemas Zod de cada endpoint
    rate-limit.ts          Rate limiting basado en Postgres
  types/database.ts    Tipos TypeScript del esquema de Supabase
supabase/migrations/   Migraciones SQL (esquema, funciones, RLS, seeds)
```

## 1. Configura Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito).
2. Ve a **SQL Editor** y ejecuta, en este orden, cada archivo de
   `supabase/migrations/` (o usa la CLI de Supabase, ver más abajo).
3. Ve a **Authentication → Providers → Discord** y actívalo (ver paso 2).
4. Ve a **Authentication → URL Configuration** y añade como *Redirect URL*:
   - `http://localhost:3000/auth/callback` (desarrollo)
   - `https://TU-DOMINIO.vercel.app/auth/callback` (producción)
5. Ve a **Database → Replication** y confirma que `radio_messages` está
   añadida a la publicación `supabase_realtime` (la migración
   `0006_realtime.sql` ya lo hace automáticamente si la publicación existe).

### Con la CLI de Supabase (alternativa recomendada)

```bash
npm install -g supabase
supabase login
supabase link --project-ref TU-PROJECT-REF
supabase db push   # aplica todas las migraciones de supabase/migrations
```

## 2. Configura Discord OAuth

1. Crea una aplicación en [discord.com/developers/applications](https://discord.com/developers/applications).
2. En **OAuth2**, añade como *Redirect URI* la URL de callback que te da
   Supabase: `https://TU-PROYECTO.supabase.co/auth/v1/callback`.
3. Copia el **Client ID** y **Client Secret**.
4. En Supabase → **Authentication → Providers → Discord**, pega ambos
   valores y guarda.

### Webhooks de Discord (logs)

No necesitas un bot para los logs de eventos: basta con crear **Webhooks**
en los canales de tu servidor de Discord (Configuración del canal →
Integraciones → Webhooks → Nuevo webhook) y pegar cada URL desde
`/admin/discord` una vez la app esté funcionando. Las URLs se guardan
cifradas en la base de datos y solo se usan desde el servidor.

## 3. Roblox

No requiere API key: se usan los endpoints públicos de Roblox
(`users.roblox.com`, `thumbnails.roblox.com`) desde el servidor
(`src/lib/roblox.ts`), evitando problemas de CORS y sin exponer nada al
cliente.

## 4. Variables de entorno

Copia `.env.example` a `.env.local` y rellena:

```bash
cp .env.example .env.local
```

| Variable | Dónde conseguirla | Secreta |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **Sí** |
| `NEXT_PUBLIC_SITE_URL` | URL pública de tu app | No |
| `CRON_SECRET` | Generado por ti (`openssl rand -hex 32`) | **Sí** |

## 5. Ejecutar en local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. Al iniciar sesión con Discord por primera
vez se te pedirá crear tu DNI; a partir de ahí toda tu información
persiste en Supabase.

**Código policial inicial**: `1212` (cámbialo cuanto antes desde
`/admin/policia`, se guarda como hash seguro, nunca en texto plano).

## 6. Sueldos automáticos cada 48h

El endpoint `GET /api/cron/pay-salaries` paga a **todos** los ciudadanos
cuyo sueldo esté vencido, de forma atómica (nadie puede cobrar dos veces).
`vercel.json` ya define un cron de Vercel que lo llama cada hora. Si
despliegas en otra plataforma, configura un cron externo (por ejemplo
[cron-job.org](https://cron-job.org)) que haga:

```
GET https://tu-dominio.com/api/cron/pay-salaries
Authorization: Bearer TU_CRON_SECRET
```

Aunque el cron nunca se ejecute, el sueldo también se cobra de forma
segura y atómica cuando el ciudadano abre la pestaña de Banco (comprobación
silenciosa) o pulsa "Cobrar sueldo" — la función `claim_salary()` en
PostgreSQL usa un bloqueo de fila para garantizar que nunca se paga dos
veces, sin importar cuántas pestañas o peticiones simultáneas haya.

## 7. Desplegar en Vercel

```bash
npm install -g vercel
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_SITE_URL
vercel env add CRON_SECRET
vercel --prod
```

Recuerda añadir la URL de producción como *Redirect URL* en Supabase Auth
(paso 1.4).

## Seguridad — resumen de lo implementado

- **RLS en todas las tablas**: cada ciudadano solo puede leer/escribir sus
  propios datos; policía/admin tienen acceso ampliado según su rol real en
  base de datos (nunca según lo que diga el cliente).
- **Dinero**: todas las operaciones (comprar licencia/producto, pagar
  multa, cobrar sueldo) se ejecutan en funciones `SECURITY DEFINER` que
  bloquean la fila, comprueban el saldo real y hacen rollback si algo
  falla. El cliente nunca envía ni puede manipular el saldo.
- **Acciones policiales**: cada función (`police_arrest`, `police_fine`,
  etc.) comprueba `is_police_authorized()` en el propio servidor de base
  de datos. Ocultar un botón en el frontend no es la protección real.
- **Código policial**: se guarda como hash `bcrypt` en `app_config`, con
  rate limiting (máx. 5 intentos / 5 min por usuario).
- **Rate limiting** adicional en compras, registro de vehículos, creación
  de DNI, proxy de Roblox y acciones policiales.
- **Auditoría inmutable**: `audit_logs` no tiene policies de
  `UPDATE`/`DELETE` para nadie, ni siquiera administradores.
- **Roblox/Discord**: toda llamada a APIs externas y todo token/secreto
  vive exclusivamente en el servidor.

## Pruebas realizadas

Dentro de este entorno de desarrollo se ha ejecutado y verificado:

- ✅ `npm install` — sin errores.
- ✅ `npm run typecheck` — 0 errores (tipado completo del esquema de Supabase, RPCs incluidas).
- ✅ `npm run lint` — 0 errores/avisos en 92 archivos.
- ✅ `npm run build` — build de producción de Next.js completo, las 48 rutas compilan (páginas dinámicas correctamente marcadas como `ƒ`, endpoint de cron con `force-dynamic`).
- ✅ `npm test` (Vitest) — 17 pruebas unitarias en verde sobre lógica pura: formateo de dinero/fechas y los esquemas Zod de los endpoints críticos (multas con importe ≤ 0 rechazadas, arrestos con duración inválida rechazados, matrículas demasiado cortas rechazadas, usuario de Roblox con caracteres inválidos rechazado, etc.).

Además, se ha revisado manualmente (lectura de código + trazas de flujo
petición → función SQL → RLS) cada uno de los siguientes escenarios:

- Alta de DNI, verificación de avatar de Roblox, persistencia tras recarga/cierre de sesión.
- Compra de licencia con y sin fondos suficientes (bloqueada en servidor, `purchase_license()`).
- Cobro de sueldo repetido (segunda llamada no paga de nuevo, `claim_salary()` con bloqueo de fila).
- Registro de vehículo con matrícula duplicada (rechazado por `register_vehicle()`).
- Acceso a `/tablet/policia` y a `/api/police/*` sin autorización (redirigido/403 vía `is_police_authorized()`).
- Acceso a `/admin/*` sin rol admin/fundador (redirigido vía `is_admin()`).
- Acciones policiales completas (arresto, multa, incautación, puntos, busca y captura) sobre un ciudadano de prueba.
- Auditoría: ninguna tabla `audit_logs` expone policy de `UPDATE`/`DELETE`.

> No ha sido posible ejecutar estas pruebas contra un proyecto Supabase
> real (sin credenciales/Internet en este entorno), así que son
> verificaciones estáticas + de build, no un end-to-end contra una base de
> datos en marcha. Antes de dar la app por definitiva, repite al menos el
> flujo de ciudadano y el flujo policial completos contra tu proyecto real.

### Nota sobre `npm audit`

`npm audit` señala vulnerabilidades conocidas en dependencias de
**desarrollo** (ESLint 8 + su plugin de Next, y Vite/esbuild usados solo
por Vitest) que requerirían saltos de versión mayores (ESLint 9, Vitest 3)
con posibles cambios de configuración. Ninguna de ellas se ejecuta en el
código que se despliega a producción (son herramientas de build/test), así
que se ha priorizado la estabilidad del proyecto; considera actualizarlas
más adelante con `npm audit fix --force` si quieres cerrarlas del todo.

## Qué falta por hacer / credenciales necesarias

Este entorno de desarrollo no tiene acceso a Internet hacia Supabase,
Discord ni Vercel, así que **no se ha desplegado nada automáticamente**.
Para dejarlo funcionando de verdad necesitas:

1. Crear el proyecto de Supabase y aplicar las migraciones (paso 1).
2. Crear la aplicación de Discord OAuth y activarla en Supabase (paso 2).
3. Rellenar `.env.local` (o las variables de entorno de Vercel) con las
   claves reales (paso 4).
4. Ejecutar `npm install && npm run build` para confirmar que compila con
   tus credenciales reales (ya verificado en este entorno sin credenciales
   reales; con ellas debería seguir compilando igual, ya que las páginas
   que usan Supabase están marcadas como dinámicas).
5. Desplegar en Vercel (paso 7) y configurar el cron (paso 6).
6. Crear los webhooks de Discord y pegarlos en `/admin/discord`.
7. Cambiar el código policial por defecto (`1212`) desde `/admin/policia`.

Sin estas credenciales no es posible probar contra una base de datos real
ni desplegar, así que no se ha simulado ningún despliegue ni URL de
producción.
