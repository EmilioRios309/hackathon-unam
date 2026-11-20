import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { getJSON, num, pct, signedPct } from '../api';
import { Blocker, Prior, Rusher, Team } from '../types';
import { Card, COLORS, ErrorBox, Loading, Select, tooltipStyle } from './ui';

const pctTick = (v: number) => `${Math.round(v * 100)}%`;

interface BlockersResp {
  prior: Prior;
  best: Blocker[];
  worst: Blocker[];
  by_position: { pos: string; snaps: number; beaten: number }[];
}

interface Col<T> {
  key: keyof T & string;
  label: string;
  hint?: string;
  fmt: (v: number) => string;
  bar?: { max: number; color: string };
  lowerIsBetter?: boolean;
}

// Tabla de líderes ordenable con barras en línea
function Leaderboard<T extends { nflId: number; displayName: string; team: string; pos: string; snaps: number }>({
  rows,
  cols,
  initial,
}: {
  rows: T[];
  cols: Col<T>[];
  initial: keyof T & string;
}) {
  const [sort, setSort] = useState<{ key: keyof T & string; desc: boolean }>({ key: initial, desc: !cols.find((c) => c.key === initial)?.lowerIsBetter });
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const va = Number(a[sort.key] ?? -Infinity);
        const vb = Number(b[sort.key] ?? -Infinity);
        return sort.desc ? vb - va : va - vb;
      }),
    [rows, sort],
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-[#1a2647]">
            <th className="text-left font-semibold py-2 w-6">#</th>
            <th className="text-left font-semibold py-2">Jugador</th>
            <th className="text-right font-semibold py-2 px-2">Snaps</th>
            {cols.map((c) => (
              <th
                key={c.key}
                title={c.hint}
                onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : !c.lowerIsBetter }))}
                className={`text-right font-semibold py-2 px-2 cursor-pointer hover:text-white whitespace-nowrap ${sort.key === c.key ? 'text-white' : ''}`}
              >
                {c.label} {sort.key === c.key ? (sort.desc ? '↓' : '↑') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.nflId} className="border-b border-[#1a2647]/60 hover:bg-[#101b38]">
              <td className="py-1.5 text-gray-500">{i + 1}</td>
              <td className="py-1.5 text-gray-100 whitespace-nowrap">
                {r.displayName} <span className="text-gray-500">{r.pos} · {r.team}</span>
              </td>
              <td className="py-1.5 text-right text-gray-400 px-2">{r.snaps}</td>
              {cols.map((c) => {
                const v = r[c.key] as unknown as number | null | undefined;
                return (
                  <td key={c.key} className="py-1.5 px-2">
                    <div className="flex items-center justify-end gap-2">
                      {c.bar && v !== null && v !== undefined && (
                        <div className="w-16 h-1.5 bg-[#1a2647] rounded hidden md:block">
                          <div className="h-1.5 rounded" style={{ width: `${Math.min(100, (v / c.bar.max) * 100)}%`, background: c.bar.color }} />
                        </div>
                      )}
                      <span className="font-mono text-gray-200 w-12 text-right">{v === null || v === undefined ? '—' : c.fmt(v)}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const TrenchesView: React.FC = () => {
  const [minSnaps, setMinSnaps] = useState('150');
  const [blockView, setBlockView] = useState<'worst' | 'best'>('worst');
  const [rushers, setRushers] = useState<{ prior: Prior; players: Rusher[] } | null>(null);
  const [blockers, setBlockers] = useState<BlockersResp | null>(null);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([
      getJSON<{ prior: Prior; players: Rusher[] }>(`api/rushers?min_snaps=${minSnaps}&limit=20`),
      getJSON<BlockersResp>(`api/blockers?min_snaps=${minSnaps}&limit=12`),
      getJSON<Team[]>('api/teams'),
    ])
      .then(([r, b, t]) => {
        setRushers(r);
        setBlockers(b);
        setTeams(t);
      })
      .catch((e: Error) => setError(e.message));
  }, [minSnaps]);

  if (error) return <ErrorBox error={error} />;
  if (!rushers || !blockers || !teams) return <Loading />;
  const hasPhys = rushers.players.some((r) => r.close_rate !== undefined && r.close_rate !== null);

  const rushCols: Col<Rusher>[] = [
    { key: 'eb_rate', label: 'Presión ajustada', hint: 'Presiones por snap, ajustadas por Empirical Bayes', fmt: (v) => pct(v), bar: { max: 0.25, color: COLORS.defense } },
    { key: 'pressures', label: 'Presiones', fmt: (v) => String(v) },
    { key: 'sacks', label: 'Sacks', fmt: (v) => String(v) },
  ];
  if (hasPhys) {
    rushCols.push(
      { key: 'close_rate', label: 'Llega a 2 yd', hint: '% de snaps en que llega a 2 yardas del QB antes del lanzamiento (tracking)', fmt: (v) => pct(v), bar: { max: 0.3, color: COLORS.pressure } },
      { key: 't_close_med', label: 'Tarda', hint: 'Mediana de segundos hasta llegar a 2 yardas del QB', fmt: (v) => `${num(v, 1)} s`, lowerIsBetter: true },
      { key: 'getoff', label: 'Salida', hint: 'Velocidad máxima en el primer segundo tras el snap (yd/s)', fmt: (v) => num(v, 2), bar: { max: 5, color: '#facc15' } },
    );
  }
  const blockCols: Col<Blocker>[] = [
    { key: 'eb_rate', label: 'Vencido (ajust.)', hint: 'pff_beatenByDefender por snap, ajustado', fmt: (v) => pct(v), bar: { max: 0.12, color: COLORS.pressure }, lowerIsBetter: true },
    { key: 'beaten', label: 'Vencido', fmt: (v) => String(v), lowerIsBetter: true },
    { key: 'sacks_allowed', label: 'Sacks perm.', fmt: (v) => String(v), lowerIsBetter: true },
    { key: 'hurries_allowed', label: 'Hurries perm.', fmt: (v) => String(v), lowerIsBetter: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <Select label="Snaps mínimos" value={minSnaps} onChange={setMinSnaps} options={['50', '100', '150', '200'].map((v) => ({ value: v, label: v }))} />
        <p className="text-xs text-gray-500 max-w-3xl">
          Tasas ajustadas por tamaño de muestra: <code>(eventos + k·μ)/(snaps + k)</code>. Haz clic en una columna para ordenar. Media de la liga: presión{' '}
          {pct(rushers.prior.mu)}, bloqueador vencido {pct(blockers.prior.mu)}.
        </p>
      </div>

      <Card
        title="Pass rushers"
        subtitle={hasPhys ? 'PFF dice quién presiona; el tracking dice qué tan rápido llega. Las dos miradas coinciden (correlación 0.79).' : 'Presiones por snap de pass rush'}
      >
        <Leaderboard rows={rushers.players} cols={rushCols} initial="eb_rate" />
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card title="Bloqueadores" subtitle="Pass Block Loss Rate: % de snaps en que el defensor le gana" className="xl:col-span-3">
          <div className="flex gap-1 mb-3">
            {(
              [
                ['worst', 'Más vencidos'],
                ['best', 'Más confiables'],
              ] as ['worst' | 'best', string][]
            ).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setBlockView(v)}
                className={`px-3 h-7 rounded-lg text-xs font-bold border ${blockView === v ? 'bg-blue-600 border-blue-500 text-white' : 'border-[#1a2647] text-gray-400'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <Leaderboard key={blockView} rows={blockView === 'worst' ? blockers.worst : blockers.best} cols={blockCols} initial="eb_rate" />
        </Card>

        <div className="xl:col-span-2 space-y-6">
          <Card title="Vencido por posición" subtitle="Los tackles y los backs que bloquean pierden más duelos que guards y centros">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={blockers.by_position}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="pos" stroke={COLORS.axis} fontSize={11} />
                <YAxis stroke={COLORS.axis} fontSize={11} tickFormatter={pctTick} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => pct(Number(v))} />
                <Bar dataKey="beaten" name="Vencido" fill={COLORS.pressure} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="beaten" position="top" fill="#94a3b8" fontSize={10} formatter={(v: unknown) => pct(Number(v), 1)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Equipos: presión sobre lo esperado" subtitle="Derecha: la defensa presiona más de lo esperado. Arriba: la ofensiva permite más.">
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ right: 12, top: 8 }}>
                <CartesianGrid stroke={COLORS.grid} />
                <XAxis type="number" dataKey="pressure_generated_oe" name="Defensa genera" stroke={COLORS.axis} fontSize={10} tickFormatter={pctTick} />
                <YAxis type="number" dataKey="pressure_allowed_oe" name="Ofensiva permite" stroke={COLORS.axis} fontSize={10} tickFormatter={pctTick} />
                <ZAxis range={[50, 50]} />
                <ReferenceLine x={0} stroke="#475569" />
                <ReferenceLine y={0} stroke="#475569" />
                <Tooltip
                  content={({ payload }) => {
                    const t = payload?.[0]?.payload as Team | undefined;
                    if (!t) return null;
                    return (
                      <div className="bg-[#0b1329] border border-[#1a2647] rounded-xl p-2 text-xs">
                        <p className="font-bold text-white">{t.team}</p>
                        <p>Ofensiva permite {pct(t.pressure_allowed)} ({signedPct(t.pressure_allowed_oe)})</p>
                        <p>Defensa genera {pct(t.pressure_generated)} ({signedPct(t.pressure_generated_oe)})</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={teams} fill="#facc15">
                  <LabelList dataKey="team" position="top" fill="#cbd5e1" fontSize={9} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
};
