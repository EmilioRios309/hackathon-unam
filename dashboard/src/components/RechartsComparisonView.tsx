import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { OffensiveSimResult, DefensiveSimResult } from '../types';

interface RechartsComparisonViewProps {
  offensiveResult?: OffensiveSimResult | null;
  defensiveResult?: DefensiveSimResult | null;
}

export const RechartsComparisonView: React.FC<RechartsComparisonViewProps> = ({
  offensiveResult,
  defensiveResult,
}) => {
  if (!offensiveResult && !defensiveResult) {
    return (
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl text-center text-gray-500 text-sm">
        Ejecuta una simulación ofensiva o defensiva para comparar métricas en tiempo real.
      </div>
    );
  }

  // Preparación de datos para el gráfico Recharts
  const chartData = [];

  if (offensiveResult) {
    chartData.push(
      {
        metric: 'Yardas Ofensivas',
        Real: offensiveResult.actual_play.yards_gained,
        Simulado: offensiveResult.simulated_play.expected_yards,
      },
      {
        metric: 'Impacto EPA (x10)',
        Real: Number((offensiveResult.actual_play.epa * 10).toFixed(2)),
        Simulado: Number((offensiveResult.simulated_play.simulated_epa * 10).toFixed(2)),
      }
    );
  }

  if (defensiveResult) {
    chartData.push(
      {
        metric: 'Yardas Permitidas',
        Real: defensiveResult.actual_defense.yards_allowed,
        Simulado: defensiveResult.simulated_defense.expected_yards_allowed,
      },
      {
        metric: 'EPA Permitido (x10)',
        Real: Number((defensiveResult.actual_defense.epa_allowed * 10).toFixed(2)),
        Simulado: Number((defensiveResult.simulated_defense.simulated_epa_allowed * 10).toFixed(2)),
      }
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl space-y-6">
      {/* Encabezado */}
      <div className="border-b border-gray-800 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-amber-400">📊</span> Comparativa de Métricas "What-If"
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Visualización del impacto contrafactual frente a lo ocurrido en el partido
          </p>
        </div>
        <span className="text-xs font-semibold bg-gray-800 text-gray-300 px-3 py-1 rounded-full border border-gray-700">
          Recharts 3.x
        </span>
      </div>

      {/* Tarjeta de Diagnóstico y Deltas Ofensivos */}
      {offensiveResult && (
        <div className="bg-blue-950/40 border border-blue-900/60 p-4 rounded-xl text-xs space-y-2">
          <div className="font-bold text-blue-400 uppercase tracking-wider text-[11px]">
            💡 Diagnóstico Táctico Ofensivo
          </div>
          <p className="text-gray-200 leading-relaxed font-medium">
            {offensiveResult.tactical_narrative}
          </p>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-blue-900/40 font-mono text-[11px]">
            <div>
              <span className="text-gray-400">Δ Yardas:</span>{' '}
              <strong className={offensiveResult.deltas.delta_yards >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {offensiveResult.deltas.delta_yards >= 0 ? `+${offensiveResult.deltas.delta_yards}` : offensiveResult.deltas.delta_yards} yds
              </strong>
            </div>
            <div>
              <span className="text-gray-400">Δ EPA:</span>{' '}
              <strong className={offensiveResult.deltas.delta_epa >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {offensiveResult.deltas.delta_epa >= 0 ? `+${offensiveResult.deltas.delta_epa}` : offensiveResult.deltas.delta_epa} pts
              </strong>
            </div>
            <div>
              <span className="text-gray-400">Prob. Éxito:</span>{' '}
              <strong className="text-blue-300">
                {Math.round(offensiveResult.simulated_play.expected_success_prob * 100)}%
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Tarjeta de Diagnóstico y Deltas Defensivos */}
      {defensiveResult && (
        <div className="bg-emerald-950/40 border border-emerald-900/60 p-4 rounded-xl text-xs space-y-2">
          <div className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
            🛡️ Diagnóstico Táctico Defensivo
          </div>
          <p className="text-gray-200 leading-relaxed font-medium">
            {defensiveResult.tactical_narrative}
          </p>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-900/40 font-mono text-[11px]">
            <div>
              <span className="text-gray-400">Yardas Prevenidas:</span>{' '}
              <strong className={defensiveResult.deltas.yards_prevented >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {defensiveResult.deltas.yards_prevented >= 0 ? `+${defensiveResult.deltas.yards_prevented}` : defensiveResult.deltas.yards_prevented} yds
              </strong>
            </div>
            <div>
              <span className="text-gray-400">EPA Prevenido:</span>{' '}
              <strong className={defensiveResult.deltas.epa_prevented >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {defensiveResult.deltas.epa_prevented >= 0 ? `+${defensiveResult.deltas.epa_prevented}` : defensiveResult.deltas.epa_prevented} pts
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de Barras Comparativo */}
      <div className="h-64 w-full bg-gray-950/60 p-3 rounded-xl border border-gray-800/80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
            <XAxis dataKey="metric" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111827',
                borderColor: '#374151',
                borderRadius: '0.75rem',
                fontSize: '12px',
                color: '#F9FAFB',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            <Bar dataKey="Real" fill="#EF4444" radius={[6, 6, 0, 0]} barSize={32} />
            <Bar dataKey="Simulado" fill="#10B981" radius={[6, 6, 0, 0]} barSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};