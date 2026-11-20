import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  LabelList,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Summary } from '../types';
import { num, pct } from '../api';
import { Card, COLORS, Kpi, tooltipStyle } from './ui';

const pctTick = (v: number) => `${Math.round(v * 100)}%`;
const pctFmt = (v: unknown) => pct(Number(v));

export const SummaryView: React.FC<{ s: Summary }> = ({ s }) => {
  const [clean, press] = s.by_pressure;
  const k = s.kpis;
  const splitRates = [
    { metric: '% completos', 'Sin presión': clean.comp_pct, 'Con presión': press.comp_pct },
    { metric: 'Éxito de la jugada', 'Sin presión': clean.success, 'Con presión': press.success },
    { metric: 'Sack', 'Sin presión': clean.sack_pct, 'Con presión': press.sack_pct },
  ];
  const cost = s.cost_by_release.map((c) => ({ ...c, err: [c.cost - c.ci_low, c.ci_high - c.cost] as [number, number] }));
  const fast = s.cost_by_release.find((c) => c.bucket === 'rapido');
  const slow = s.cost_by_release.find((c) => c.bucket === 'largo');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Costo de la presión"
          value={`${num(k.pressure_cost_ypa, 1)} yd`}
          hint={`por intento · IC95 [${num(k.pressure_cost_ci[0], 1)}, ${num(k.pressure_cost_ci[1], 1)}]`}
          tone="bad"
        />
        <Kpi label="Tasa de presión" value={pct(k.pressure_rate)} hint="dropbacks con hit, hurry o sack" />
        {s.has_tracking ? (
          <Kpi label="Tiempo hasta lanzar" value={`${num(k.ttt_median, 1)} s`} hint="mediana del snap al lanzamiento o sack" />
        ) : (
          <Kpi label="Sack" value={pct(k.sack_rate)} hint="por dropback" />
        )}
        <Kpi
          label="Muestra"
          value={`${s.population.plays_analyzed.toLocaleString()} jugadas`}
          hint={`${s.population.season}, semanas ${s.population.weeks[0]}-${s.population.weeks[1]} · ${s.population.games} juegos`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card
          title="Lo que cambia con presión"
          subtitle={`El % de completos baja de ${pct(clean.comp_pct, 0)} a ${pct(press.comp_pct, 0)} y las yardas por intento de ${num(k.ypa_clean, 1)} a ${num(k.ypa_pressure, 1)}.`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={splitRates} barGap={4}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="metric" stroke={COLORS.axis} fontSize={11} />
              <YAxis stroke={COLORS.axis} fontSize={11} tickFormatter={pctTick} />
              <Tooltip {...tooltipStyle} formatter={pctFmt} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Sin presión" fill={COLORS.clean} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="Sin presión" position="top" fill="#94a3b8" fontSize={10} formatter={(v: unknown) => pct(Number(v), 0)} />
              </Bar>
              <Bar dataKey="Con presión" fill={COLORS.pressure} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="Con presión" position="top" fill="#94a3b8" fontSize={10} formatter={(v: unknown) => pct(Number(v), 0)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {s.has_tracking && (
          <Card
            title="El reloj de la presión"
            subtitle="Cada medio segundo que el QB retiene el balón sube la presión. Pasados los 4 s, uno de cada cinco dropbacks termina en sack."
          >
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={s.by_ttt}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="bucket" stroke={COLORS.axis} fontSize={11} tickFormatter={(v: string) => `${v} s`} />
                <YAxis stroke={COLORS.axis} fontSize={11} tickFormatter={pctTick} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={pctFmt}
                  labelFormatter={(l: unknown) => {
                    const r = s.by_ttt.find((x) => x.bucket === l);
                    return `${l} s · ${r?.plays ?? 0} jugadas`;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="pressure" name="Presión" fill={COLORS.pressure} radius={[4, 4, 0, 0]} />
                <Line dataKey="sack" name="Sack" stroke="#ef4444" strokeWidth={2} dot />
                <Line dataKey="success" name="Éxito ofensivo" stroke={COLORS.clean} strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        )}

        {s.has_tracking && fast && slow && (
          <Card
            title="La presión cuesta más cuando el QB retiene el balón"
            subtitle={`Yardas por intento perdidas por presión: ${num(fast.cost, 1)} si lanza rápido y ${num(slow.cost, 1)} si tarda más de 3.5 s. La línea punteada es el promedio de la liga.`}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cost}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="label" stroke={COLORS.axis} fontSize={11} />
                <YAxis stroke={COLORS.axis} fontSize={11} domain={[-6, 0]} />
                <ReferenceLine y={k.pressure_cost_ypa} stroke="#e5e7eb" strokeDasharray="4 4" />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: unknown, n: unknown) => (n === 'err' ? null : `${num(Number(v), 2)} yd`)}
                  labelFormatter={(l: unknown) => {
                    const r = cost.find((x) => x.label === l);
                    return `${l} · ${r?.attempts ?? 0} intentos (${pct(r?.share, 0)})`;
                  }}
                />
                <Bar dataKey="cost" name="Costo" fill="#ef4444" radius={[0, 0, 4, 4]}>
                  <ErrorBar dataKey="err" width={6} stroke="#e5e7eb" />
                  <LabelList dataKey="cost" position="bottom" fill="#e5e7eb" fontSize={11} formatter={(v: unknown) => num(Number(v), 1)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card title="¿Enviar más rushers paga?" subtitle="La presión sube con cada rusher, pero el sack no: con 6 rushers es menor que con 5.">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={s.by_rushers}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="rushers" stroke={COLORS.axis} fontSize={11} tickFormatter={(v: number) => `${v} rushers`} />
              <YAxis stroke={COLORS.axis} fontSize={11} tickFormatter={pctTick} />
              <Tooltip
                {...tooltipStyle}
                formatter={pctFmt}
                labelFormatter={(l: unknown) => `${l} rushers · ${s.by_rushers.find((x) => x.rushers === Number(l))?.plays ?? 0} jugadas`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pressure" name="Presión" fill={COLORS.pressure} radius={[4, 4, 0, 0]} />
              <Line dataKey="sack" name="Sack" stroke="#ef4444" strokeWidth={2} dot />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <details className="bg-[#0b1329] border border-[#1a2647] rounded-2xl p-5 group">
        <summary className="cursor-pointer text-sm font-bold text-white list-none flex justify-between">
          Más contexto: coberturas, play action y situación
          <span className="text-gray-500 group-open:rotate-180 transition">▾</span>
        </summary>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-4">
          <div>
            <p className="text-xs text-gray-400 mb-2">Coberturas (100 intentos o más): % completos y presión</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={s.by_coverage}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="coverage" stroke={COLORS.axis} fontSize={10} />
                <YAxis stroke={COLORS.axis} fontSize={10} tickFormatter={pctTick} />
                <Tooltip {...tooltipStyle} formatter={pctFmt} />
                <Bar dataKey="comp_pct" name="% completos" fill={COLORS.clean} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pressure" name="Presión" fill={COLORS.pressure} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">Play action: más yardas por intento con la misma presión</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={s.play_action}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="label" stroke={COLORS.axis} fontSize={10} />
                <YAxis stroke={COLORS.axis} fontSize={10} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => num(Number(v), 2)} />
                <Bar dataKey="ypa" name="Yardas por intento" fill="#facc15" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="ypa" position="top" fill="#94a3b8" fontSize={10} formatter={(v: unknown) => num(Number(v), 1)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">Presión por down y distancia</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={s.by_situation}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="situation" stroke={COLORS.axis} fontSize={9} interval={0} angle={-35} textAnchor="end" height={50} />
                <YAxis stroke={COLORS.axis} fontSize={10} tickFormatter={pctTick} />
                <Tooltip {...tooltipStyle} formatter={pctFmt} />
                <Bar dataKey="pressure" name="Presión" fill={COLORS.pressure} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </details>
    </div>
  );
};
