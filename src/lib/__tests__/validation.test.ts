import { describe, expect, it } from 'vitest';
import {
  createDniSchema,
  fineSchema,
  arrestSchema,
  removePointsSchema,
  registerVehicleSchema,
  panelAdminSetPasswordSchema,
} from '@/lib/validation';

describe('createDniSchema', () => {
  it('acepta datos válidos', () => {
    const result = createDniSchema.safeParse({
      firstName: 'Alejandro',
      lastName: 'García López',
      birthDate: '2000-01-01',
      robloxUsername: 'Usuario_123',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un usuario de Roblox con caracteres inválidos', () => {
    const result = createDniSchema.safeParse({
      firstName: 'Ana',
      lastName: 'Pérez',
      birthDate: '2000-01-01',
      robloxUsername: 'nombre con espacios!',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza nombres demasiado cortos', () => {
    const result = createDniSchema.safeParse({
      firstName: 'A',
      lastName: 'Pérez',
      birthDate: '2000-01-01',
      robloxUsername: 'validUser',
    });
    expect(result.success).toBe(false);
  });
});

describe('fineSchema', () => {
  it('rechaza importes negativos o cero (el servidor nunca debe procesar una multa de 0€ o negativa)', () => {
    expect(fineSchema.safeParse({ citizenId: crypto.randomUUID(), reason: 'Exceso de velocidad', amountEuros: 0 }).success).toBe(
      false,
    );
    expect(
      fineSchema.safeParse({ citizenId: crypto.randomUUID(), reason: 'Exceso de velocidad', amountEuros: -50 }).success,
    ).toBe(false);
  });

  it('acepta un importe positivo válido', () => {
    expect(
      fineSchema.safeParse({ citizenId: crypto.randomUUID(), reason: 'Exceso de velocidad', amountEuros: 250 }).success,
    ).toBe(true);
  });
});

describe('arrestSchema', () => {
  it('rechaza duraciones no positivas', () => {
    expect(
      arrestSchema.safeParse({ citizenId: crypto.randomUUID(), reason: 'Resistencia', durationMinutes: 0 }).success,
    ).toBe(false);
  });

  it('rechaza duraciones excesivas (> 24h)', () => {
    expect(
      arrestSchema.safeParse({ citizenId: crypto.randomUUID(), reason: 'Resistencia', durationMinutes: 5000 }).success,
    ).toBe(false);
  });
});

describe('removePointsSchema', () => {
  it('rechaza quitar 0 o puntos negativos', () => {
    expect(removePointsSchema.safeParse({ citizenId: crypto.randomUUID(), points: 0, reason: 'x' }).success).toBe(false);
    expect(removePointsSchema.safeParse({ citizenId: crypto.randomUUID(), points: -3, reason: 'x' }).success).toBe(false);
  });
});

describe('registerVehicleSchema', () => {
  it('rechaza matrículas demasiado cortas', () => {
    expect(registerVehicleSchema.safeParse({ plate: 'AB', brand: 'Ford', model: 'Focus', color: 'Rojo' }).success).toBe(
      false,
    );
  });
});

describe('panelAdminSetPasswordSchema', () => {
  it('rechaza una contraseña nueva que no sea solo números', () => {
    expect(
      panelAdminSetPasswordSchema.safeParse({ currentPassword: '0000', newPassword: 'abcd' }).success,
    ).toBe(false);
  });

  it('rechaza una contraseña nueva demasiado corta o demasiado larga', () => {
    expect(panelAdminSetPasswordSchema.safeParse({ currentPassword: '0000', newPassword: '12' }).success).toBe(false);
    expect(
      panelAdminSetPasswordSchema.safeParse({ currentPassword: '0000', newPassword: '1234567890123' }).success,
    ).toBe(false);
  });

  it('acepta una contraseña nueva numérica de longitud válida', () => {
    expect(panelAdminSetPasswordSchema.safeParse({ currentPassword: '0000', newPassword: '4821' }).success).toBe(true);
  });
});
