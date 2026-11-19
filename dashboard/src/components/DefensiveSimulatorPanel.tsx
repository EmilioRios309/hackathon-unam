import React, { useState } from 'react';
import { Play, DefensiveSimResult } from '../types';

interface DefensiveSimulatorPanelProps {
  play: Play;
  onSimulate: (result: DefensiveSimResult) => void;
}

export const DefensiveSimulatorPanel: React.FC<DefensiveSimulatorPanelProps> = ({
  play,
  onSimulate,
}) => {
  const [coverage, setCoverage] = useState<string>('cover_4');
  const [blitzCount, setBlitzCount] = useState<number>(4);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunSimulation = async () => {
    setLoading(true);
    setError(null);

    try {
      // OBLIGATORIO: Ruta relativa sin diagonal inicial para subrutas del hackathon
      const response = await fetch('api/simulate/defensive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          play_id: play.play_id,
          sim_coverage: coverage,
          sim_blitz_count: blitzCount,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor: ${response.statusText}`);
      }

      const data: DefensiveSimResult = await response.json();
      onSimulate(data);
    } catch (err: any) {
      console.error('Error al ejecutar la simulación defensiva:', err);
      setError('No se pudo calcular la simulación defensiva. Verifica que el backend esté activo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
      <div>
        {/* Encabezado */}
        <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400">🛡️</span> Simulación Contrafactual Defensiva
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Evalúa respuestas defensivas, presiones y coberturas alternativas
            </p>
          </div>
          <span className="text-xs font-mono bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-800">
            {play.defensive_team} Defensa
          </span>
        </div>

        {/* Resumen de la postura defensiva real */}
        <div className="bg-gray-800/60 border border-gray-700/60 p-3.5 rounded-xl mb-5 text-xs text-gray-300">
          <div className="font-semibold text-gray-200 mb-1">Esquema Defensivo Real Ocurrido:</div>
          <div className="flex gap-4 font-mono text-[11px] mt-1">
            <span>Cobertura: <strong className="text-white uppercase">{play.actual_defense_coverage}</strong></span>
            <span>Rushers: <strong className="text-amber-400">{play.actual_blitz_count} hombres</strong></span>
            <span>Yardas Permitidas: <strong className="text-rose-400">{play.actual_yards_gained} yds</strong></span>
          </div>
        </div>

        {/* Selector 1: Cobertura Defensiva */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              1. Cobertura Defensiva Alternativa
            </label>
            <select
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="cover_0">Cover 0 (Hombre a hombre sin safety profundo - Alto riesgo)</option>
              <option value="cover_1">Cover 1 (Hombre a hombre con 1 safety profundo)</option>
              <option value="cover_2">Cover 2 (Zona con 2 safeties profundos)</option>
              <option value="cover_3">Cover 3 (Zona profunda de 3 tercios)</option>
              <option value="cover_4">Cover 4 (Cuarta zona profunda / Prevenir pase largo)</option>
              <option value="cover_2_man">Cover 2 Man (Cobertura personal con ayuda de 2 safeties)</option>
              <option value="blitz_zero">Blitz Zero (Sobrecarga agresiva sin ayuda)</option>
            </select>
          </div>

          {/* Selector 2: Presión / Blitzers */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-gray-300">
                2. Número de Pass Rushers / Blitzers
              </label>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {blitzCount} Rushers
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="7"
              step="1"
              value={blitzCount}
              onChange={(e) => setBlitzCount(parseInt(e.target.value))}
              className="w-full accent-emerald-500 bg-gray-800 rounded-lg cursor-pointer h-2"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>3 (Contain/Cobertura)</span>
              <span>4 (Rush Estándar)</span>
              <span>5-7 (Blitz Agresivo)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="mt-4 p-2.5 bg-red-950/80 border border-red-800 text-red-300 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Botón de Ejecución */}
      <button
        onClick={handleRunSimulation}
        disabled={loading}
        className={`w-full mt-6 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
          loading
            ? 'bg-emerald-800 text-emerald-300 cursor-not-allowed'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.99]'
        }`}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Simulando Defensa...</span>
          </>
        ) : (
          <>
            <span>🛡️ Ajustar Esquema Defensivo</span>
          </>
        )}
      </button>
    </div>
  );
};