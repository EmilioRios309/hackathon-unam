import React, { useState } from 'react';
import { Play, OffensiveSimResult } from '../types';

interface OffensiveSimulatorPanelProps {
  play: Play;
  onSimulate: (result: OffensiveSimResult) => void;
}

export const OffensiveSimulatorPanel: React.FC<OffensiveSimulatorPanelProps> = ({
  play,
  onSimulate,
}) => {
  const [playType, setPlayType] = useState<string>('pass');
  const [targetGap, setTargetGap] = useState<string>('checkdown');
  const [aggressiveness, setAggressiveness] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunSimulation = async () => {
    setLoading(true);
    setError(null);

    try {
      // OBLIGATORIO: Ruta relativa sin diagonal inicial para subrutas de despliegue
      const response = await fetch('api/simulate/offensive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          play_id: play.play_id,
          sim_play_type: playType,
          sim_target_gap: targetGap,
          aggressiveness: aggressiveness,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor: ${response.statusText}`);
      }

      const data: OffensiveSimResult = await response.json();
      onSimulate(data);
    } catch (err: any) {
      console.error('Error al ejecutar la simulación ofensiva:', err);
      setError('No se pudo calcular la simulación. Verifica que el backend esté activo.');
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
              <span className="text-blue-400">⚡</span> Simulación Contrafactual Ofensiva
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Evalúa decisiones alternativas en el llamado de jugada
            </p>
          </div>
          <span className="text-xs font-mono bg-blue-950 text-blue-400 px-2.5 py-1 rounded-md border border-blue-800">
            {play.possession_team} Ofensiva
          </span>
        </div>

        {/* Resumen de la jugada real seleccionada */}
        <div className="bg-gray-800/60 border border-gray-700/60 p-3.5 rounded-xl mb-5 text-xs text-gray-300">
          <div className="font-semibold text-gray-200 mb-1">Jugada Real Ocurrida:</div>
          <div className="text-gray-400 italic mb-2">"{play.play_description}"</div>
          <div className="flex gap-4 font-mono text-[11px]">
            <span>Tipo: <strong className="text-white uppercase">{play.actual_play_type}</strong></span>
            <span>Target: <strong className="text-white font-sans">{play.actual_target_gap}</strong></span>
            <span>Ganancia: <strong className="text-emerald-400">{play.actual_yards_gained} yds</strong></span>
          </div>
        </div>

        {/* Selector 1: Tipo de Jugada */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              1. Tipo de Jugada Alternativa
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPlayType('pass');
                  setTargetGap('checkdown');
                }}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                  playType === 'pass'
                    ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                🏈 Pase (Pass)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlayType('run');
                  setTargetGap('zone_left');
                }}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                  playType === 'run'
                    ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                🏃 Acarreo (Run)
              </button>
            </div>
          </div>

          {/* Selector 2: Ruta u Objetivo Alternativo */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              2. Objetivo / Ruta / Carril Alternativo
            </label>
            <select
              value={targetGap}
              onChange={(e) => setTargetGap(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              {playType === 'pass' ? (
                <>
                  <option value="checkdown">Checkdown / Válvula de Escape (Alta completitud)</option>
                  <option value="short_left">Pase Corto Izquierda</option>
                  <option value="short_middle">Pase Corto Centro</option>
                  <option value="short_right">Pase Corto Derecha</option>
                  <option value="deep_left">Pase Profundo Izquierda</option>
                  <option value="deep_middle">Pase Profundo Centro</option>
                  <option value="deep_right">Pase Profundo Derecha</option>
                </>
              ) : (
                <>
                  <option value="zone_left">Acarreo Zona Izquierda</option>
                  <option value="power_right">Acarreo Potencia Derecha</option>
                  <option value="qb_scramble">Acarreo / Escapar del QB por el Centro</option>
                </>
              )}
            </select>
          </div>

          {/* Selector 3: Nivel de Agresividad / Ajuste de Ejecución */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-gray-300">
                3. Agresividad / Profundidad de Ruta
              </label>
              <span className="text-xs font-mono font-bold text-blue-400">
                {aggressiveness.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.4"
              step="0.1"
              value={aggressiveness}
              onChange={(e) => setAggressiveness(parseFloat(e.target.value))}
              className="w-full accent-blue-500 bg-gray-800 rounded-lg cursor-pointer h-2"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>Conservador (0.8x)</span>
              <span>Estándar (1.0x)</span>
              <span>Agresivo (1.4x)</span>
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
            ? 'bg-blue-800 text-blue-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.99]'
        }`}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Simulando Escenario...</span>
          </>
        ) : (
          <>
            <span>⚡ Ejecutar Simulación "What-If"</span>
          </>
        )}
      </button>
    </div>
  );
};