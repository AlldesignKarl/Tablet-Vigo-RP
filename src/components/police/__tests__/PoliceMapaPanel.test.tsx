// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PoliceMapaPanel from '../PoliceMapaPanel';

// Simula el cliente de Supabase para poder ejercitar el componente de
// verdad (montarlo, hacer clic derecho, elegir un tipo de marcador) sin
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

describe('PoliceMapaPanel', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('crea un marcador de tipo "incidente" tras clic derecho + selección, sin lanzar excepciones', async () => {
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

    // Mock de getBoundingClientRect: el mapa no tiene layout real en jsdom.
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

    const mapContainer = mapBox.parentElement?.parentElement as HTMLElement;
    fireEvent.contextMenu(mapContainer, { clientX: 100, clientY: 100 });

    const incidenteOption = await screen.findByText('Incidente');
    fireEvent.click(incidenteOption);

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
