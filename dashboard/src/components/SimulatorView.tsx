import React, { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getJSON, num, pct, postJSON, signed, signedPct } from '../api';
import { Perspective, PlayRow, PressureMode, ReleaseMode, SimResult, Team } from '../types';
import { Card, COLORS, ErrorBox, Loading, Select, tooltipStyle } from './ui';
import { Field2DView } from './Field2DView';

const pctTick = (v: number) => `${Math.round(v * 100)}%`;
const b = (x: boolean) => (x ? 1 : 0);
const RELEASE_NAME: Record<string, string> = { rapido: 'rápido', normal: 'normal', largo: 'largo' };

interface SimReq {
  gameId: number;
  playId: number;
  rushers: number | null;
  pressure: PressureMode;
  release: ReleaseMode;
}

interface Row {
  label: string;
  real: number;
  expected: number;
  simulated: number;
  kind: 'pct' | 'yd';
  goodWhenUp: boolean;
}

function perspectiveRows(r: SimResult, p: Perspective): Row[] {
  const { real, expected: e, simulated: s, scenario } = r;
  if (p === 'offense') {
    return [
      { label: 'Yardas ganadas', real: real.yards, expected: e.yards, simulated: s.yards, kind: 'yd', goodWhenUp: true },
      { label: 'Éxito de la jugada', real: b(real.success), expected: e.success, simulated: s.success, kind: 'pct', goodWhenUp: true },
      { label: 'Pase completo', real: b(real.comp), expected: e.comp, simulated: s.comp, kind: 'pct', goodWhenUp: true },
      { label: 'Sack recibido', real: b(real.sack), expected: e.sack, simulated: s.sack, kind: 'pct', goodWhenUp: false },
      { label: 'Presión recibida', real: b(real.pressure), expected: r.model.p_pressure_actual, simulated: scenario.p_pressure, kind: 'pct', goodWhenUp: false },
    ];
  }
  return [
    { label: 'Yardas permitidas', real: real.yards, expected: e.yards, simulated: s.yards, kind: 'yd', goodWhenUp: false },
    { label: 'Jugada detenida', real: 1 - b(real.success), expected: 1 - e.success, simulated: 1 - s.success, kind: 'pct', goodWhenUp: true },
    { label: 'Presión generada', real: b(real.pressure), expected: r.model.p_pressure_actual, simulated: scenario.p_pressure, kind: 'pct', goodWhenUp: true },
    { label: 'Sack', real: b(real.sack), expected: e.sack, simulated: s.sack, kind: 'pct', goodWhenUp: true },
    { label: 'Intercepción', real: b(real.int), expected: e.int, simulated: s.int, kind: 'pct', goodWhenUp: true },
  ];
}

const fmt = (v: number, kind: Row['kind']) => (kind === 'yd' ? num(v, 1) : pct(v, 0));
const fmtReal = (v: number, kind: Row['kind']) => (kind === 'yd' ? num(v, 0) : v >= 0.5 ? 'Sí' : 'No');

const PerspectivePanel: React.FC<{ r: SimResult; p: Perspective; req: SimReq }> = ({ r, p, req }) => {
  const rows = perspectiveRows(r, p);
  const team = p === 'offense' ? r.play.offense : r.play.defense;
  const [ai, setAi] = useState<{ loading: boolean; text: string | null; tried: boolean }>({ loading: false, text: null, tried: false });
  useEffect(() => setAi({ loading: false, text: null, tried: false }), [req.gameId, req.playId, req.rushers, req.pressure, req.release]);

  const ask = () => {
    setAi({ loading: true, text: null, tried: true });
    postJSON<{ available: boolean; text: string | null }>('api/explain', { ...req, perspective: p })
      .then((d) => setAi({ loading: false, text: d.available ? d.text : null, tried: true }))
      .catch(() => setAi({ loading: false, text: null, tried: true }));
  };
  const accent = p === 'offense' ? 'from-blue-600 to-indigo-600' : 'from-emerald-600 to-teal-600';

  return (
    <Card className="flex-1 min-w-0">
      <div className={`inline-flex items-center gap-2 text-xs font-bold text-white px-3 py-1 rounded-full bg-gradient-to-r ${accent}`}>
        {p === 'offense' ? 'Ofensiva' : 'Defensiva'} · {team}
      </div>
      <table className="w-full text-xs mt-3">
        <thead>
          <tr className="text-gray-500">
            <th className="text-left font-semibold pb-1.5" />
            <th className="text-right font-semibold pb-1.5">Real</th>
            <th className="text-right font-semibold pb-1.5">Esperado</th>
            <th className="text-right font-semibold pb-1.5">Simulado</th>
            <th className="text-right font-semibold pb-1.5">Cambio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const d = row.simulated - row.expected;
            const flat = Math.abs(d) < (row.kind === 'yd' ? 0.05 : 0.005);
            const good = !flat && (row.goodWhenUp ? d > 0 : d < 0);
            return (
              <tr key={row.label} className="border-t border-[#1a2647]">
                <td className="py-1.5 text-gray-200">{row.label}</td>
                <td className="py-1.5 text-right text-gray-400 font-mono">{fmtReal(row.real, row.kind)}</td>
                <td className="py-1.5 text-right text-indigo-300 font-mono">{fmt(row.expected, row.kind)}</td>
                <td className="py-1.5 text-right text-emerald-300 font-mono font-bold">{fmt(row.simulated, row.kind)}</td>
                <td className={`py-1.5 text-right font-mono ${flat ? 'text-gray-600' : good ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {flat ? '=' : row.kind === 'yd' ? signed(d, 1) : signedPct(d, 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3">
        <button
          onClick={ask}
          disabled={ai.loading}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-[#1a2647] text-gray-400 hover:bg-[#152042] disabled:opacity-50"
        >
          {ai.loading ? 'Consultando IA…' : 'Explicar con IA'}
        </button>
        {ai.text && <p className="text-xs text-gray-200 mt-2 leading-relaxed bg-[#070d1e] border border-[#1a2647] rounded-lg p-3">{ai.text}</p>}
        {ai.tried && !ai.loading && !ai.text && <p className="text-[11px] text-gray-500 mt-2">IA no disponible; el análisis no depende de ella.</p>}
      </div>
    </Card>
  );
};

const Seg: React.FC<{ label: string; options: [string, string][]; value: string; onChange: (v: string) => void; disabled?: boolean; tone?: string; hint?: string }> = ({
  label,
  options,
  value,
  onChange,
  disabled,
  tone = 'bg-emerald-600 border-emerald-500',
  hint,
}) => (
  <div>
    <p className="text-[11px] text-gray-400 font-semibold mb-1">
      {label} {hint && <span className="text-gray-600 font-normal">· {hint}</span>}
    </p>
    <div className="flex gap-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={`px-2.5 h-8 rounded-lg text-xs font-bold border transition disabled:opacity-40 ${
            value === v ? `${tone} text-white` : 'border-[#1a2647] text-gray-300 hover:bg-[#152042]'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  </div>
);

export const SimulatorView: React.FC = () => {
  const [teams, setTeams] = useState<string[]>([]);
  const [filters, setFilters] = useState({ team: '', week: '', pressure: '', down: '', q: '' });
  const [list, setList] = useState<{ total: number; plays: PlayRow[] } | null>(null);
  const [req, setReq] = useState<SimReq | null>(null);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJSON<Team[]>('api/teams')
      .then((t) => setTeams(t.map((x) => x.team).sort()))
      .catch(() => setTeams([]));
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams({ limit: '80' });
    Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v));
    const h = setTimeout(() => {
      getJSON<{ total: number; plays: PlayRow[] }>(`api/plays?${qs.toString()}`)
        .then((d) => {
          setList(d);
          setReq((cur) => cur ?? (d.plays[0] ? { gameId: d.plays[0].gameId, playId: d.plays[0].playId, rushers: null, pressure: 'auto', release: 'auto' } : null));
        })
        .catch((e: Error) => setError(e.message));
    }, 250);
    return () => clearTimeout(h);
  }, [filters]);

  const run = useCallback((r: SimReq) => {
    postJSON<SimResult>('api/simulate', r)
      .then(setSim)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    if (req) run(req);
  }, [req, run]);

  if (error) return <ErrorBox error={error} />;

  const f = (k: keyof typeof filters) => (v: string) => setFilters((x) => ({ ...x, [k]: v }));
  const actualR = sim?.real.rushers ?? 4;
  const simR = req?.rushers ?? actualR;
  const select = (p: PlayRow) => {
    setHighlight(null);
    setReq({ gameId: p.gameId, playId: p.playId, rushers: null, pressure: 'auto', release: 'auto' });
  };
  const changed = req && (req.rushers !== null || req.pressure !== 'auto' || req.release !== 'auto');

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Lista de jugadas */}
      <Card title="Jugadas" subtitle={list ? `${list.total.toLocaleString()} coinciden` : ''} className="xl:col-span-3">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Select label="Equipo" value={filters.team} onChange={f('team')} options={[{ value: '', label: 'Todos' }, ...teams.map((t) => ({ value: t, label: t }))]} />
          <Select
            label="Semana"
            value={filters.week}
            onChange={f('week')}
            options={[{ value: '', label: 'Todas' }, ...[1, 2, 3, 4, 5, 6, 7, 8].map((w) => ({ value: String(w), label: String(w) }))]}
          />
          <Select
            label="Presión real"
            value={filters.pressure}
            onChange={f('pressure')}
            options={[
              { value: '', label: 'Todas' },
              { value: 'yes', label: 'Con presión' },
              { value: 'no', label: 'Sin presión' },
            ]}
          />
          <Select
            label="Down"
            value={filters.down}
            onChange={f('down')}
            options={[{ value: '', label: 'Todos' }, ...[1, 2, 3, 4].map((d) => ({ value: String(d), label: `${d}º` }))]}
          />
        </div>
        <input
          value={filters.q}
          onChange={(e) => f('q')(e.target.value)}
          placeholder="Buscar QB o texto (ej. Mahomes, sacked)"
          className="w-full bg-[#070d1e] border border-[#1a2647] rounded-lg px-2 py-1.5 text-xs text-gray-100 mb-2"
        />
        <div className="max-h-[1100px] overflow-y-auto space-y-1.5 pr-1">
          {!list && <p className="text-xs text-gray-500">Cargando…</p>}
          {list?.plays.map((p) => {
            const active = req?.gameId === p.gameId && req?.playId === p.playId;
            return (
              <button
                key={`${p.gameId}-${p.playId}`}
                onClick={() => select(p)}
                className={`w-full text-left p-2 rounded-lg border text-[11px] transition ${active ? 'border-blue-500 bg-blue-950/40' : 'border-[#1a2647] hover:bg-[#152042]'}`}
              >
                <div className="flex justify-between text-gray-300 font-semibold">
                  <span>
                    S{p.week} · {p.possessionTeam} vs {p.defensiveTeam} · {p.down}º y {p.yardsToGo}
                  </span>
                  <span className={p.pressure ? 'text-orange-400' : 'text-sky-400'}>{p.ttt !== null ? `${num(p.ttt, 1)} s` : ''}</span>
                </div>
                <p className="text-gray-500 truncate">{p.playDescription}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="xl:col-span-9 space-y-6">
        {!sim || !req ? (
          <Loading text="Selecciona una jugada" />
        ) : (
          <>
            {/* Encabezado */}
            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-base text-white font-bold">
                  {sim.play.offense} vs {sim.play.defense} · {sim.play.down}º y {sim.play.yardsToGo} · Q{sim.play.quarter} {sim.play.gameClock}
                </p>
                <p className="text-xs">
                  <span className="font-bold text-white">
                    {sim.real.result_label}, {num(sim.real.yards, 0)} yd
                  </span>
                  <span className={`ml-2 font-semibold ${sim.real.pressure ? 'text-orange-400' : 'text-sky-400'}`}>
                    {sim.real.pressure ? 'con presión' : 'sin presión'} · {sim.real.rushers} rushers
                    {sim.real.ttt !== null && ` · lanzó a los ${num(sim.real.ttt, 1)} s`}
                  </span>
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-1">{sim.play.description}</p>
              <p className="text-[11px] text-gray-500 mt-1">
                QB {sim.play.qb ?? '—'} · {sim.play.formation ?? '—'} · cobertura {sim.play.coverage} · {sim.play.play_action ? 'play action · ' : ''}
                {sim.play.yards_to_goal} yd a la zona de anotación
              </p>
            </Card>

            {/* Campo 2D + duelos */}
            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6 items-start">
              <Card title="La jugada real" subtitle="Vista desde atrás de la ofensiva. Pasa el cursor o haz clic en un jugador para seguirlo." className="2xl:col-span-8">
                {sim.has_tracking ? (
                  <Field2DView gameId={req.gameId} playId={req.playId} highlight={highlight} onHighlight={setHighlight} />
                ) : (
                  <p className="text-xs text-gray-500">No hay datos de tracking disponibles.</p>
                )}
              </Card>
              <Card title="Duelos en la trinchera" subtitle="Pasa el cursor sobre un nombre para ubicarlo en el campo" className="2xl:col-span-4">
                <p className="text-[11px] uppercase tracking-wide text-orange-400 font-bold mb-1">Pass rush · {sim.play.defense}</p>
                <ul className="text-xs mb-4">
                  {sim.participants.rushers.map((r) => (
                    <li
                      key={r.nflId}
                      onMouseEnter={() => setHighlight(r.nflId)}
                      onMouseLeave={() => setHighlight(null)}
                      className={`flex justify-between gap-2 border-b border-[#1a2647] py-1 px-1 rounded cursor-default ${highlight === r.nflId ? 'bg-[#152042]' : ''}`}
                    >
                      <span className="text-gray-200 truncate">
                        {r.name} <span className="text-gray-500">{r.pos}</span>
                      </span>
                      <span className="flex gap-1 shrink-0">
                        {r.sack && <Badge c="bg-red-600">sack</Badge>}
                        {r.hit && <Badge c="bg-orange-600">hit</Badge>}
                        {r.hurry && <Badge c="bg-amber-600">hurry</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] uppercase tracking-wide text-blue-400 font-bold mb-1">Protección · {sim.play.offense}</p>
                <ul className="text-xs">
                  {sim.participants.blockers.map((r) => (
                    <li
                      key={r.nflId}
                      onMouseEnter={() => setHighlight(r.nflId)}
                      onMouseLeave={() => setHighlight(null)}
                      className={`flex justify-between gap-2 border-b border-[#1a2647] py-1 px-1 rounded cursor-default ${highlight === r.nflId ? 'bg-[#152042]' : ''}`}
                    >
                      <span className="text-gray-200 truncate">
                        {r.name} <span className="text-gray-500">{r.aligned}</span>
                        {r.blocked && <span className="text-gray-500"> → {r.blocked}</span>}
                      </span>
                      <span className="flex gap-1 shrink-0">
                        {r.beaten && <Badge c="bg-orange-600">vencido</Badge>}
                        {r.allowed.map((a) => (
                          <Badge key={a} c="bg-red-700">
                            {a}
                          </Badge>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
                {sim.real.dist_release !== null && (
                  <p className="text-[11px] text-gray-400 mt-3">
                    Al {sim.real.sack ? 'sack' : 'soltar el balón'}, el rusher más cercano estaba a{' '}
                    <b className="text-gray-100">{num(sim.real.dist_release, 1)} yd</b> del QB.
                    {sim.real.t_first_close !== null && (
                      <>
                        {' '}
                        La presión llegó a 2 yd a los <b className="text-gray-100">{num(sim.real.t_first_close, 1)} s</b>.
                      </>
                    )}
                  </p>
                )}
              </Card>
            </div>

            {/* Escenario */}
            <Card title="¿Y si…?" subtitle="Cambia una palanca. El resultado se recalcula con el modelo y las tasas reales de la liga en esta situación.">
              <div className="flex flex-wrap items-end gap-5">
                <Seg
                  label="Rushers enviados"
                  hint={`real ${actualR}`}
                  options={[3, 4, 5, 6, 7].map((n) => [String(n), String(n)])}
                  value={String(simR)}
                  onChange={(v) => setReq({ ...req, rushers: Number(v) })}
                  disabled={req.pressure !== 'auto'}
                />
                {sim.has_tracking && (
                  <Seg
                    label="Tiempo hasta lanzar"
                    hint={sim.real.release ? `real ${RELEASE_NAME[sim.real.release]}` : undefined}
                    options={[
                      ['auto', 'Sin fijar'],
                      ['rapido', '< 2.5 s'],
                      ['normal', '2.5-3.5 s'],
                      ['largo', '> 3.5 s'],
                    ]}
                    value={req.release}
                    onChange={(v) => setReq({ ...req, release: v as ReleaseMode })}
                    tone="bg-blue-600 border-blue-500"
                  />
                )}
                <Seg
                  label="Presión"
                  options={[
                    ['auto', 'Según el escenario'],
                    ['yes', 'Forzar'],
                    ['no', 'Bolsa limpia'],
                  ]}
                  value={req.pressure}
                  onChange={(v) => setReq({ ...req, pressure: v as PressureMode })}
                  tone="bg-orange-600 border-orange-500"
                />
                {changed && (
                  <button
                    onClick={() => setReq({ ...req, rushers: null, pressure: 'auto', release: 'auto' })}
                    className="px-3 h-8 rounded-lg text-xs font-semibold border border-[#1a2647] text-gray-400 hover:bg-[#152042]"
                  >
                    Restablecer
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-3">
                P(presión): esperada <b className="text-indigo-300">{pct(sim.model.p_pressure_actual)}</b> → escenario{' '}
                <b className="text-emerald-300">{pct(sim.scenario.p_pressure)}</b>. <b>Esperado</b> es lo que logra la liga en esta situación con los rushers
                reales. <b>Simulado</b> es tu escenario.
              </p>
            </Card>

            <div className="flex flex-col lg:flex-row gap-6">
              <PerspectivePanel r={sim} p="offense" req={req} />
              <PerspectivePanel r={sim} p="defense" req={req} />
            </div>

            {/* Curvas de decisión */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {sim.release_curve.length > 0 && (
                <Card title="El reloj del QB" subtitle={`Con ${simR} rushers: qué pasa según cuánto tarda en lanzar`}>
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={sim.release_curve}>
                      <CartesianGrid stroke={COLORS.grid} vertical={false} />
                      <XAxis dataKey="label" stroke={COLORS.axis} fontSize={11} />
                      <YAxis stroke={COLORS.axis} fontSize={11} tickFormatter={pctTick} />
                      <Tooltip {...tooltipStyle} formatter={(v: unknown) => pct(Number(v), 0)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="p_pressure" name="Presión" fill={COLORS.pressure} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="sack" name="Sack" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="success" name="Éxito ofensivo" fill={COLORS.clean} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
              <Card title="Cuántos enviar" subtitle={`Presión y éxito esperados según los rushers${req.release !== 'auto' ? `, con lanzamiento ${RELEASE_NAME[req.release]}` : ''}`}>
                <ResponsiveContainer width="100%" height={230}>
                  <ComposedChart data={sim.curve}>
                    <CartesianGrid stroke={COLORS.grid} vertical={false} />
                    <XAxis dataKey="rushers" stroke={COLORS.axis} fontSize={11} />
                    <YAxis stroke={COLORS.axis} fontSize={11} tickFormatter={pctTick} />
                    <Tooltip {...tooltipStyle} formatter={(v: unknown) => pct(Number(v), 0)} labelFormatter={(l: unknown) => `${l} rushers`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine x={actualR} stroke={COLORS.real} label={{ value: 'real', fill: COLORS.real, fontSize: 10, position: 'top' }} />
                    <Bar dataKey="p_pressure" name="Presión" fill={COLORS.pressure} radius={[4, 4, 0, 0]} />
                    <Line dataKey="sack" name="Sack" stroke="#ef4444" dot />
                    <Line dataKey="success" name="Éxito ofensivo" stroke={COLORS.clean} dot />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Badge: React.FC<{ c: string; children: React.ReactNode }> = ({ c, children }) => (
  <span className={`${c} text-white text-[10px] font-bold px-1.5 py-0.5 rounded`}>{children}</span>
);
