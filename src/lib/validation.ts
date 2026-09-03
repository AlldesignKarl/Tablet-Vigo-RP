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

export const purchaseLicenseSchema = z.object({ licenseTypeId: z.string().uuid() });
export const purchaseProductSchema = z.object({ productId: z.string().uuid() });
export const payFineSchema = z.object({ fineId: z.string().uuid() });

export const policeAccessCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'El código debe tener 6 dígitos.'),
});

export const searchCitizenSchema = z.object({
  query: z.string().trim().min(2).max(80),
  by: z.enum(['dni', 'nombre', 'roblox']).default('nombre'),
});

export const searchPlateSchema = z.object({ plate: z.string().trim().min(2).max(12) });

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
});

export const clearWantedSchema = z.object({ citizenId: z.string().uuid() });

export const radioMessageSchema = z.object({
  channel: z.string().trim().min(1).max(30).default('general'),
  message: z.string().trim().min(1).max(500),
});

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
