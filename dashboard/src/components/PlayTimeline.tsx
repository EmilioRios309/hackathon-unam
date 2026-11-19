import React, { useState } from 'react';
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
  const [quarterFilter, setQuarterFilter] = useState<number | 'ALL'>('ALL');
  const [keyOnlyFilter, setKeyOnlyFilter] = useState<boolean>(false);

  if (!plays || plays.length === 0) {
    return (
      <div className="w-full bg-gray-900 border border-gray-800 p-6 rounded-2xl text-center text-gray-400 text-sm">
        Cargando catálogo de jugadas del partido...
      </div>
    );
  }

  const filteredPlays = plays.filter((play) => {
    const matchesQuarter = quarterFilter === 'ALL' || play.quarter === quarterFilter;
    const isKeyMoment = play.down >= 3 || Math.abs(play.actual_epa) >= 1.0;
    const matchesKey = !keyOnlyFilter || isKeyMoment;
    return matchesQuarter && matchesKey;
  });

  return (
    <section className="w-full bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-xl mb-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-blue-500">🏈</span> Catálogo de Jugadas Clave
          </h2>
          <p className="text-xs text-gray-400">
            Filtra por cuarto o momentos críticos para simular escenarios "What-If"
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700/80 text-xs">
            {(['ALL', 1, 2, 3, 4] as const).map((q) => (
              <button
                key={q}
                onClick={() => setQuarterFilter(q)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  quarterFilter === q
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {q === 'ALL' ? 'Todos' : `Q${q}`}
              </button>
            ))}
          </div>

          <button
            onClick={() => setKeyOnlyFilter(!keyOnlyFilter)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
              keyOnlyFilter
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/10'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <span>⭐</span>
            <span>Solo Claves (3er/4to Down)</span>
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-400 flex justify-between items-center px-1">
        <span>Mostrando <strong>{filteredPlays.length}</strong> de {plays.length} jugadas</span>
        {filteredPlays.length === 0 && (
          <span className="text-amber-400 font-medium">No hay jugadas que coincidan con el filtro.</span>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 pt-1 custom-scrollbar">
        {filteredPlays.map((play) => {
          const isSelected = selectedPlay?.play_id === play.play_id;
          const isKeyMoment = play.down >= 3 || Math.abs(play.actual_epa) >= 1.0;

          return (
            <button
              key={play.play_id}
              onClick={() => onSelectPlay(play)}
              className={`flex-shrink-0 w-64 p-4 rounded-xl text-left border transition-all duration-200 relative ${
                isSelected
                  ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/10 scale-[1.02]'
                  : 'bg-gray-800/80 border-gray-700/80 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
              }`}
            >
              {isKeyMoment && (
                <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" title="Momento Clave" />
              )}

              <div className="flex justify-between items-center text-xs font-semibold text-gray-400 mb-1.5">
                <span className="text-blue-400 font-mono">Q{play.quarter} • {play.time_remaining}</span>
                <span className="font-mono text-[11px] text-gray-500">#{play.play_id}</span>
              </div>

              <div className="font-bold text-sm text-white mb-1">
                {play.down}º & {play.ydstogo} yds <span className="text-xs text-gray-400 font-normal">({play.possession_team} vs {play.defensive_team})</span>
              </div>

              <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed mb-3">
                {play.play_description}
              </p>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-700/60 font-mono">
                <span className="text-gray-400">EPA Real:</span>
                <span
                  className={`font-bold ${
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
