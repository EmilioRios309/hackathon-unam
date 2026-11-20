import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { getJSON, num, pct, signed } from '../api';
import { QB, Summary } from '../types';
import { Card, COLORS, ErrorBox, Kpi, Loading, Select, tooltipStyle } from './ui';

const pctTick = (v: number) => `${Math.round(v * 100)}%`;
const lastName = (n: string) => n.split(' ').slice(-1)[0];

export const QBView: React.FC<{ s: Summary }> = ({ s }) => {
  const [qbs, setQbs] = useState<QB[] | null>(null);
  const [sel, setSel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJSON<QB[]>('api/qbs?min_dropbacks=100')
      .then((d) => {
        setQbs(d);
        if (d.length) setSel(String(d[0].nflId));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const q = useMemo(() => qbs?.find((x) => String(x.nflId) === sel), [qbs, sel]);
  if (error) return <ErrorBox error={error} />;
  if (!qbs) return <Loading />;

  const hasTrk = s.has_tracking && qbs.some((x) => x.ttt_median !== undefined && x.ttt_median !== null);
  const pts = qbs.map((x) => ({ ...x, short: lastName(x.qb) }));
  const tot = qbs.reduce((a, b) => a + b.dropbacks, 0);
  const avgPress = qbs.reduce((a, b) => a + b.pressure_rate * b.dropbacks, 0) / tot;
  const avgTtt = s.kpis.ttt_median ?? 2.8;
  const ys = qbs.map((x) => x.pressure_rate);
  const xs = qbs.map((x) => x.ttt_median ?? avgTtt);
  const [x0, x1] = [Math.min(...xs) - 0.05, Math.max(...xs) + 0.05];
  const [y0, y1] = [Math.min(...ys) - 0.02, Math.max(...ys) + 0.02];

  const clock = q && hasTrk
    ? (['rapido', 'normal', 'largo'] as const).map((b) => ({
        label: b === 'rapido' ? '< 2.5 s' : b === 'normal' ? '2.5-3.5 s' : '> 3.5 s',
        uso: q[`share_${b}`] ?? 0,
        qb: q[`pressure_${b}`] ?? null,
        liga: s.pressure_by_release[b] ?? null,
      }))
    : [];

  return (
    <div className="space-y-6">
      {hasTrk ? (
        <Card
          title="¿La presión es de la línea o del QB?"
          subtitle="Cada punto es un QB. Los que retienen el balón (derecha) reciben más presión: la correlación entre su tiempo hasta lanzar y su presión es 0.63."
        >
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid stroke={COLORS.grid} />
              <ReferenceArea x1={x0} x2={avgTtt} y1={avgPress} y2={y1} fill="#ef4444" fillOpacity={0.06} />
              <ReferenceArea x1={avgTtt} x2={x1} y1={avgPress} y2={y1} fill="#f59e0b" fillOpacity={0.06} />
              <XAxis
                type="number"
                dataKey="ttt_median"
                name="Tiempo hasta lanzar"
                domain={[x0, x1]}
                stroke={COLORS.axis}
                fontSize={11}
                tickFormatter={(v: number) => `${v.toFixed(1)} s`}
                label={{ value: 'Tiempo mediano hasta lanzar →', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 11 }}
              />
              <YAxis type="number" dataKey="pressure_rate" name="Presión" domain={[y0, y1]} stroke={COLORS.axis} fontSize={11} tickFormatter={pctTick} />
              <ZAxis type="number" dataKey="dropbacks" range={[40, 140]} />
              <ReferenceLine x={avgTtt} stroke="#475569" strokeDasharray="4 4" />
              <ReferenceLine y={avgPress} stroke="#475569" strokeDasharray="4 4" />
              <Tooltip
                content={({ payload }) => {
                  const t = payload?.[0]?.payload as QB | undefined;
                  if (!t) return null;
                  return (
                    <div className="bg-[#0b1329] border border-[#1a2647] rounded-xl p-2 text-xs">
                      <p className="font-bold text-white">
                        {t.qb} ({t.team})
                      </p>
                      <p>
                        Lanza en {num(t.ttt_median, 1)} s · presión {pct(t.pressure_rate)}
                      </p>
                    </div>
                  );
                }}
              />
              <Scatter data={pts} fill={COLORS.offense} onClick={(d: unknown) => setSel(String((d as QB).nflId))} className="cursor-pointer">
                <LabelList dataKey="short" position="top" fill="#cbd5e1" fontSize={9} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] mt-1">
            <p className="bg-red-950/20 border border-red-900/40 rounded-lg p-2 text-gray-300">
              <b className="text-red-300">Arriba a la izquierda:</b> lanza rápido y aun así lo presionan. El problema apunta a la protección.
            </p>
            <p className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-2 text-gray-300">
              <b className="text-amber-300">Arriba a la derecha:</b> retiene el balón y recibe presión. Parte de la presión la genera el propio QB.
            </p>
          </div>
        </Card>
      ) : null}

      <div className="flex items-end gap-4">
        <Select
          label="Quarterback (o haz clic en un punto)"
          value={sel}
          onChange={setSel}
          options={[...qbs].sort((a, b) => a.qb.localeCompare(b.qb)).map((x) => ({ value: String(x.nflId), label: `${x.qb} (${x.team})` }))}
        />
      </div>

      {q && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Kpi
              label="Presión recibida"
              value={pct(q.pressure_rate)}
              hint={`esperada ${pct(q.expected_pressure)} (${signed((q.pressure_rate - q.expected_pressure) * 100, 1, ' pp')})`}
              tone={q.pressure_rate > q.expected_pressure ? 'bad' : 'good'}
            />
            {hasTrk && (
              <Kpi
                label="Tiempo hasta lanzar"
                value={`${num(q.ttt_median, 1)} s`}
                hint={`${pct(q.quick_rate, 0)} de sus dropbacks en menos de 2.5 s`}
                tone={(q.ttt_median ?? 0) > avgTtt ? 'bad' : 'good'}
              />
            )}
            {hasTrk && <Kpi label="Rusher al soltar" value={`${num(q.dist_release_med, 1)} yd`} hint="distancia mediana del rusher más cercano" />}
            <Kpi
              label="Costo de la presión"
              value={`${num(q.pressure_cost, 1)} yd`}
              hint={`por intento · IC95 [${num(q.cost_ci_low, 1)}, ${num(q.cost_ci_high, 1)}]`}
              tone={(q.pressure_cost ?? -2) > -2 ? 'good' : 'bad'}
            />
            <Kpi label="Sack por presión" value={pct(q.sack_per_pressure)} hint={`sack en ${pct(q.sack_rate)} de dropbacks`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {hasTrk && (
              <Card title={`${q.qb}: presión según su reloj`} subtitle="Presión recibida por tramo de tiempo hasta lanzar, contra la liga">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={clock}>
                    <CartesianGrid stroke={COLORS.grid} vertical={false} />
                    <XAxis dataKey="label" stroke={COLORS.axis} fontSize={11} />
                    <YAxis stroke={COLORS.axis} fontSize={11} tickFormatter={pctTick} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: unknown) => pct(Number(v), 0)}
                      labelFormatter={(l: unknown) => {
                        const c = clock.find((x) => x.label === l);
                        return `${l} · ${pct(c?.uso, 0)} de sus dropbacks`;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="qb" name={lastName(q.qb)} fill={COLORS.offense} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="liga" name="Liga" fill="#334155" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
            <Card title={`${q.qb}: bolsa limpia contra presión`}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={[
                    { m: '% completos', 'Sin presión': q.comp_clean, 'Con presión': q.comp_pressure },
                    { m: 'Éxito', 'Sin presión': q.success_clean, 'Con presión': q.success_pressure },
                  ]}
                >
                  <CartesianGrid stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="m" stroke={COLORS.axis} fontSize={11} />
                  <YAxis stroke={COLORS.axis} fontSize={11} tickFormatter={pctTick} />
                  <Tooltip {...tooltipStyle} formatter={(v: unknown) => pct(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Sin presión" fill={COLORS.clean} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Con presión" fill={COLORS.pressure} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-gray-500 mt-1">
                Yardas por intento: {num(q.ypa_clean, 1)} sin presión y {num(q.ypa_pressure, 1)} con presión ({q.attempts_pressure} intentos bajo presión).
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
