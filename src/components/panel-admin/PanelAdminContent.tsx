'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Palette, KeyRound, UserCog, LogOut, Search } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import type { AppRole } from '@/types/database';

interface Job {
  id: string;
  code: string;
  name: string;
  salary_cents: number;
}

interface SearchResult {
  profile_id: string;
  first_name: string;
  last_name: string;
  dni_number: string;
  roblox_username: string;
  role: AppRole;
  job_id: string | null;
  job_code: string | null;
  job_name: string | null;
}

type Tab = 'ajustes' | 'password' | 'roles';

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: 'ajustes', label: 'Ajustes', icon: Palette },
  { id: 'password', label: 'Contraseña', icon: KeyRound },
  { id: 'roles', label: 'Buscar y dar rol', icon: UserCog },
];

export default function PanelAdminContent({
  password,
  jobs,
  initialTheme,
  onLock,
}: {
  password: string;
  jobs: Job[];
  initialTheme: 'dark' | 'light';
  onLock: () => void;
}) {
  const [tab, setTab] = useState<Tab>('ajustes');

  return (
    <div className="space-y-4">
      <div className="hud-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-success-500" strokeWidth={1.75} />
          <div>
            <h1 className="font-display text-base font-bold text-white">Panel Admin</h1>
            <p className="text-xs text-slate-500">Ajustes de la tablet y asignación de roles.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLock}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
          Bloquear
        </button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/[0.02] p-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                tab === t.id ? 'bg-accent-500/20 text-accent-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'ajustes' && <AjustesTab password={password} initialTheme={initialTheme} />}
      {tab === 'password' && <PasswordTab password={password} onPasswordChanged={onLock} />}
      {tab === 'roles' && <RolesTab password={password} jobs={jobs} />}
    </div>
  );
}

function AjustesTab({ password, initialTheme }: { password: string; initialTheme: 'dark' | 'light' }) {
  const router = useRouter();
  const { push } = useToast();
  const [theme, setTheme] = useState(initialTheme);
  const [saving, setSaving] = useState(false);

  async function setThemeTo(next: 'dark' | 'light') {
    if (next === theme || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/panel-admin/set-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, theme: next }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'No se pudo cambiar el tema', message: json.error });
        return;
      }
      setTheme(next);
      push({ kind: 'success', title: 'Tema actualizado' });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hud-panel space-y-4 p-5">
      <h2 className="text-sm font-bold text-white">Tema de la tablet</h2>
      <p className="text-xs text-slate-400">Cambia el fondo de toda la tablet para todos los que la usan.</p>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => setThemeTo('dark')}
          className={`flex-1 rounded-xl border p-4 text-center text-sm font-semibold transition disabled:opacity-50 ${
            theme === 'dark' ? 'border-accent-500/60 bg-accent-500/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-400'
          }`}
        >
          🌙 Oscuro
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setThemeTo('light')}
          className={`flex-1 rounded-xl border p-4 text-center text-sm font-semibold transition disabled:opacity-50 ${
            theme === 'light' ? 'border-accent-500/60 bg-accent-500/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-400'
          }`}
        >
          ☀️ Claro
        </button>
      </div>
    </div>
  );
}

function PasswordTab({ password, onPasswordChanged }: { password: string; onPasswordChanged: () => void }) {
  const { push } = useToast();
  const [current, setCurrent] = useState(password);
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{4,12}$/.test(next)) {
      setError('La nueva contraseña debe tener solo números (4 a 12 dígitos).');
      return;
    }
    if (next !== confirm) {
      setError('Las dos contraseñas nuevas no coinciden.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/panel-admin/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'No se pudo cambiar la contraseña.');
        return;
      }
      push({ kind: 'success', title: 'Contraseña actualizada', message: 'Vuelve a desbloquear el panel con la nueva contraseña.' });
      onPasswordChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="hud-panel space-y-4 p-5">
      <h2 className="text-sm font-bold text-white">Cambiar contraseña del Panel Admin</h2>
      <p className="text-xs text-slate-400">Debe ser solo números (entre 4 y 12 dígitos).</p>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Contraseña actual</label>
          <input
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            inputMode="numeric"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Contraseña nueva</label>
          <input
            value={next}
            onChange={(e) => setNext(e.target.value)}
            inputMode="numeric"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Repite la contraseña nueva</label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            inputMode="numeric"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
          />
        </div>
      </div>

      {error && <p className="text-xs font-medium text-danger-500">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-accent-600 py-2.5 text-sm font-bold text-white transition hover:bg-accent-500 disabled:opacity-50"
      >
        {saving ? 'Guardando…' : 'Guardar nueva contraseña'}
      </button>
    </form>
  );
}

function RolesTab({ password, jobs }: { password: string; jobs: Job[] }) {
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch('/api/panel-admin/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, query }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setSearchError(json.error ?? 'No se pudo buscar.');
        setResults(null);
        return;
      }
      setResults(json.data as SearchResult[]);
    } finally {
      setSearching(false);
    }
  }

  async function assignJob(profileId: string, jobId: string) {
    setSavingId(profileId);
    try {
      const res = await fetch('/api/panel-admin/set-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, profileId, jobId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: 'error', title: 'No se pudo asignar el rol', message: json.error });
        return;
      }
      const job = jobs.find((j) => j.id === jobId);
      setResults((prev) => prev?.map((r) => (r.profile_id === profileId ? { ...r, job_id: jobId, job_code: job?.code ?? null, job_name: job?.name ?? null } : r)) ?? null);
      push({ kind: 'success', title: 'Rol asignado' });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="hud-panel flex flex-wrap gap-2 p-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre, apellidos, DNI o usuario de Roblox"
          className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
        />
        <button
          type="submit"
          disabled={searching || query.trim().length < 2}
          className="flex items-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500 disabled:opacity-50"
        >
          <Search className="h-4 w-4" strokeWidth={1.75} />
          {searching ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {searchError && <p className="text-xs font-medium text-danger-500">{searchError}</p>}

      {results && results.length === 0 && <p className="text-sm text-slate-500">Sin resultados.</p>}

      {results && results.length > 0 && (
        <div className="hud-panel divide-y divide-white/5">
          {results.map((r) => (
            <div key={r.profile_id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-[200px] flex-1">
                <p className="font-medium text-white">
                  {r.first_name} {r.last_name}
                </p>
                <p className="text-xs text-slate-500">
                  {r.dni_number} · @{r.roblox_username} · {r.job_name ?? 'Sin empleo'}
                </p>
              </div>
              <select
                defaultValue={r.job_id ?? ''}
                disabled={savingId === r.profile_id}
                onChange={(e) => e.target.value && assignJob(r.profile_id, e.target.value)}
                className="rounded-lg border border-white/10 bg-base-800 px-3 py-1.5 text-sm text-white outline-none"
              >
                <option value="" disabled>
                  Elegir rol…
                </option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
