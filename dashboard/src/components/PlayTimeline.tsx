import React from 'react';
import { Play } from '../types';

interface PlayTimelineProps {
  plays: Play[];
  selectedPlay: Play | null;
  onSelectPlay: (play: Play) => void;
}

export const PlayTimeline: React.FC<PlayTimelineProps> = ({
  plays,
  selectedPlay,
  onSelectPlay,
}) => {
  if (!plays || plays.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl text-center text-gray-400 text-sm">
        Cargando catálogo de jugadas del partido...
      </div>
    );
  }

  return (
    <section className="bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-xl mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-blue-500">🏈</span> Catálogo de Jugadas Clave
          </h2>
          <p className="text-xs text-gray-400">
            Selecciona un momento táctico del partido para iniciar la simulación contrafactual
          </p>
        </div>
        <span className="text-xs font-semibold bg-gray-800 text-gray-300 px-3 py-1 rounded-full border border-gray-700">
          {plays.length} Jugadas Disponibles
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        {plays.map((play) => {
          const isSelected = selectedPlay?.play_id === play.play_id;
          const isKeyMoment = play.down >= 3 || Math.abs(play.actual_epa) >= 1.0;

          return (
            <button
              key={play.play_id}
              onClick={() => onSelectPlay(play)}
              className={`flex-shrink-0 w-56 p-3.5 rounded-xl text-left border transition-all duration-200 relative ${
                isSelected
                  ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/10 scale-[1.02]'
                  : 'bg-gray-800/80 border-gray-700/80 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
              }`}
            >
              {/* Badge de momento clave */}
              {isKeyMoment && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Momento de Alto Impacto" />
              )}

              {/* Encabezado: Cuarto y Reloj */}
              <div className="flex justify-between items-center text-xs font-semibold text-gray-400 mb-1">
                <span className="text-blue-400 font-mono">Q{play.quarter} • {play.time_remaining}</span>
                <span className="font-mono text-[10px] text-gray-500">ID: #{play.play_id}</span>
              </div>

              {/* Situación de campo */}
              <div className="font-bold text-sm text-white mb-1">
                {play.down}º & {play.ydstogo} yds <span className="text-xs text-gray-400 font-normal">({play.possession_team} vs {play.defensive_team})</span>
              </div>

              {/* Descripción breve */}
              <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed mb-2">
                {play.play_description}
              </p>

              {/* Métrica de EPA Real */}
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-700/50">
                <span className="text-gray-400">EPA Real:</span>
                <span
                  className={`font-mono font-bold ${
                    play.actual_epa >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {play.actual_epa >= 0 ? `+${play.actual_epa.toFixed(2)}` : play.actual_epa.toFixed(2)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};