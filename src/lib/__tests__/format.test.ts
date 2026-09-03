import { describe, expect, it } from 'vitest';
import { centsToEuros, eurosToCents, timeUntil } from '@/lib/format';

describe('centsToEuros / eurosToCents', () => {
  it('convierte céntimos a una cadena de euros formateada', () => {
    // No asumimos separador de miles (depende de los datos ICU del
    // entorno), solo que se muestran los céntimos y el símbolo de euro.
    const formatted = centsToEuros(150000);
    expect(formatted).toContain('1500');
    expect(formatted).toContain('00');
    expect(formatted).toContain('€');
  });

  it('convierte euros a céntimos redondeando correctamente', () => {
    expect(eurosToCents(19.99)).toBe(1999);
    expect(eurosToCents(0.1)).toBe(10);
  });

  it('es inversa consigo misma para valores exactos', () => {
    expect(eurosToCents(2500 / 100)).toBe(2500);
  });
});

describe('timeUntil', () => {
  it('devuelve "Disponible ahora" para fechas pasadas', () => {
    expect(timeUntil(new Date(Date.now() - 1000).toISOString())).toBe('Disponible ahora');
  });

  it('devuelve "—" cuando no hay fecha', () => {
    expect(timeUntil(null)).toBe('—');
  });

  it('calcula horas y minutos restantes para una fecha futura', () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString();
    expect(timeUntil(future)).toMatch(/^2h/);
  });
});
