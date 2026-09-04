// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import PoliceMapaPanel from '../PoliceMapaPanel';

// Simula el cliente de Supabase para poder ejercitar el componente de
// verdad (montarlo, elegir un tipo de marcador, tocar el mapa) sin
// necesitar credenciales reales ni red: así se comprueba que la
// interacción no lanza ninguna excepción, en vez de solo leer el código.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({
      on: function () {
        return this;
      },
      subscribe: function () {
        return this;
      },
    }),
    removeChannel: () => {},
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [] }),
      }),
    }),
  }),
}));

const originalFetch = global.fetch;

function mockMapBoundingRect() {
  const mapBox = document.querySelector('.aspect-square') as HTMLElement;
  expect(mapBox).toBeTruthy();
  vi.spyOn(mapBox, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 500,
    height: 500,
    right: 500,
    bottom: 500,
    x: 0,
    y: 0,
    toJSON: () => {},
  } as DOMRect);
  return mapBox;
}

describe('PoliceMapaPanel', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('crea un marcador de tipo "incidente" tras elegirlo en la barra y tocar el mapa, sin lanzar excepciones', async () => {
    const createdMarker = {
      id: 'marker-1',
      created_by: 'officer-1',
      callsign: 'Z-10',
      type: 'incidente',
      x: 0.5,
      y: 0.5,
      note: null,
      created_at: new Date().toISOString(),
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: createdMarker }),
    });

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<PoliceMapaPanel initialMarkers={[]} />);

    // 1) Elegir "Incidente" en la barra de tipos.
    const incidenteButton = screen.getByRole('button', { name: 'Incidente' });
    fireEvent.click(incidenteButton);

    // 2) Tocar el mapa (mock de getBoundingClientRect: no hay layout real en jsdom).
    const mapBox = mockMapBoundingRect();
    const mapContainer = mapBox.parentElement?.parentElement as HTMLElement;
    fireEvent.pointerDown(mapContainer, { clientX: 100, clientY: 100 });
    fireEvent.click(mapContainer, { clientX: 100, clientY: 100 });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/police/map/create-marker',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    // El marcador creado debe pintarse sin que el árbol de React lance
    // ningún error (que la burbuja de errores habría silenciado).
    await waitFor(() => {
      expect(screen.getAllByTitle(/Incidente/)).toHaveLength(1);
    });

    const reactErrors = consoleError.mock.calls.filter((args) =>
      args.some((a) => typeof a === 'string' && (a.includes('Error') || a.includes('error'))),
    );
    expect(reactErrors).toHaveLength(0);
  });

  it('no coloca un marcador si el toque fue en realidad un arrastre para mover el mapa', async () => {
    render(<PoliceMapaPanel initialMarkers={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Botón de pánico' }));

    const mapBox = mockMapBoundingRect();
    const mapContainer = mapBox.parentElement?.parentElement as HTMLElement;
    fireEvent.pointerDown(mapContainer, { clientX: 50, clientY: 50 });
    // Se mueve bastante antes de soltar: es un arrastre, no un toque.
    fireEvent.click(mapContainer, { clientX: 200, clientY: 200 });

    await new Promise((r) => setTimeout(r, 50));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('no revienta si un marcador ya existente tiene un tipo desconocido', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Simula una fila corrupta a propósito: un "type" que no existe en
    // MARKER_META (imposible en teoría por el check constraint de la BD,
    // pero el componente no debe reventar aunque llegase a pasar).
    const badMarker = {
      id: 'bad-1',
      created_by: 'officer-1',
      callsign: 'Z-10',
      type: 'tipo_invalido',
      x: 0.2,
      y: 0.2,
      note: null,
      created_at: new Date().toISOString(),
    } as unknown as Parameters<typeof PoliceMapaPanel>[0]['initialMarkers'][number];

    expect(() => render(<PoliceMapaPanel initialMarkers={[badMarker]} />)).not.toThrow();
    consoleError.mockRestore();
  });
});
