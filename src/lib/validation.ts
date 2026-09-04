import { z } from 'zod';

export const createDniSchema = z.object({
  firstName: z.string().trim().min(2, 'El nombre es demasiado corto.').max(60),
  lastName: z.string().trim().min(2, 'Los apellidos son demasiado cortos.').max(80),
  birthDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha de nacimiento inválida.'),
  robloxUsername: z
    .string()
    .trim()
    .min(3, 'El usuario de Roblox es demasiado corto.')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Usuario de Roblox inválido.'),
});

export const registerVehicleSchema = z.object({
  plate: z.string().trim().min(4).max(12),
  brand: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(40),
  color: z.string().trim().min(1).max(30),
});

export const deleteVehicleSchema = z.object({ vehicleId: z.string().uuid() });

export const purchaseLicenseSchema = z.object({ licenseTypeId: z.string().uuid() });
export const purchaseProductSchema = z.object({ productId: z.string().uuid() });
export const payFineSchema = z.object({ fineId: z.string().uuid() });

export const searchCitizenSchema = z.object({
  query: z.string().trim().min(2).max(80),
  by: z.enum(['dni', 'nombre', 'roblox']).default('nombre'),
});

export const searchPlateSchema = z.object({ plate: z.string().trim().min(2).max(12) });

export const fileComplaintSchema = z.object({
  accusedDescription: z.string().trim().min(2, 'Indica a quién denuncias.').max(200),
  reason: z.string().trim().min(5, 'Cuenta con un poco más de detalle el motivo.').max(500),
});

export const updateComplaintStatusSchema = z.object({
  complaintId: z.string().uuid(),
  status: z.enum(['pendiente', 'en_inspeccion', 'cerrada']),
});

export const arrestSchema = z.object({
  citizenId: z.string().uuid(),
  reason: z.string().trim().min(3).max(300),
  durationMinutes: z.number().int().positive().max(1440),
});

export const fineSchema = z.object({
  citizenId: z.string().uuid(),
  reason: z.string().trim().min(3).max(300),
  amountEuros: z.number().positive().max(1_000_000),
});

export const confiscateSchema = z.object({
  citizenId: z.string().uuid(),
  material: z.string().trim().min(2).max(120),
  quantity: z.string().trim().min(1).max(40),
  reason: z.string().trim().min(3).max(300),
});

export const impoundVehicleSchema = z.object({
  vehicleId: z.string().uuid(),
  reason: z.string().trim().min(3).max(300),
});

export const releaseVehicleSchema = z.object({ vehicleId: z.string().uuid() });

export const removePointsSchema = z.object({
  citizenId: z.string().uuid(),
  points: z.number().int().positive().max(20),
  reason: z.string().trim().min(3).max(300),
});

export const wantedSchema = z.object({
  citizenId: z.string().uuid(),
  reason: z.string().trim().min(3).max(300),
  vehiclePlate: z.string().trim().max(12).optional(),
});

export const clearWantedSchema = z.object({ citizenId: z.string().uuid() });

export const createMapMarkerSchema = z.object({
  type: z.enum(['posicion', 'panico', 'incidente', 'control']),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  note: z.string().trim().max(200).optional(),
});

export const deleteMapMarkerSchema = z.object({ markerId: z.string().uuid() });

export const adminConfigSchema = z.object({
  key: z.string().trim().min(1).max(60),
  value: z.record(z.unknown()),
});

export const adminJobSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  salaryEuros: z.number().nonnegative().max(1_000_000),
});

export const adminLicenseTypeSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(''),
  icon: z.string().trim().max(8).default('🪪'),
  priceEuros: z.number().nonnegative().max(1_000_000),
  active: z.boolean().default(true),
  renewable: z.boolean().default(false),
});

export const adminPoliceUserSchema = z.object({
  profileId: z.string().uuid(),
  callsign: z.string().trim().min(1).max(10),
  rank: z.string().trim().min(1).max(40).default('Agente'),
  authorized: z.boolean().default(true),
});

export const adminRoleSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum(['ciudadano', 'policia', 'admin', 'fundador']),
});

export const adminAssignJobSchema = z.object({
  profileId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export const panelAdminPasswordSchema = z.object({
  password: z.string().trim().min(1).max(20),
});

export const panelAdminSetThemeSchema = z.object({
  password: z.string().trim().min(1).max(20),
  theme: z.enum(['dark', 'light']),
});

export const panelAdminSetPasswordSchema = z.object({
  currentPassword: z.string().trim().min(1).max(20),
  newPassword: z.string().trim().regex(/^\d{4,12}$/, 'La contraseña debe ser solo números (4 a 12 dígitos).'),
});

export const panelAdminSearchSchema = z.object({
  password: z.string().trim().min(1).max(20),
  query: z.string().trim().min(2).max(80),
});

export const panelAdminSetJobSchema = z.object({
  password: z.string().trim().min(1).max(20),
  profileId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export const createInternalAffairsPostSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export const deleteInternalAffairsPostSchema = z.object({ postId: z.string().uuid() });

export const createRaidSchema = z.object({
  title: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(4000).default(''),
});

export const updateRaidNotesSchema = z.object({
  raidId: z.string().uuid(),
  notes: z.string().trim().max(4000),
});

export const deleteRaidSchema = z.object({ raidId: z.string().uuid() });

const raidPointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

export const addRaidStrokeSchema = z.object({
  raidId: z.string().uuid(),
  points: z.array(raidPointSchema).min(2).max(2000),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido.')
    .default('#ef4444'),
});

export const clearRaidStrokesSchema = z.object({ raidId: z.string().uuid() });
