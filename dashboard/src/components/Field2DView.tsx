import React from 'react';
import { Play, OffensiveSimResult, DefensiveSimResult } from '../types';

interface Field2DViewProps {
  play: Play;
  offensiveResult?: OffensiveSimResult | null;
  defensiveResult?: DefensiveSimResult | null;
  activeTab: 'offensive' | 'defensive';
}

export const Field2DView: React.FC<Field2DViewProps> = ({
  play,
  offensiveResult,
  defensiveResult,
  activeTab,
}) => {
  // Conversión de yardas a coordenadas X dentro del SVG (Rango x: 100 a 900)
  const getYardX = (yardline100: number) => {
    const clamped = Math.max(0, Math.min(100, yardline100));
    return 100 + (100 - clamped) * 8;
  };

  const startX = getYardX(play.yardline_100);
  const firstDownYard = Math.max(0, play.yardline_100 - play.ydstogo);
  const firstDownX = getYardX(firstDownYard);

  // Lectura segura de yardas sin errores de tipo
  const actualYards = (play as any).yards_gained ?? play.actual_yards_gained ?? 0;
  const actualEndX = getYardX(play.yardline_100 - actualYards);

  let simYards = actualYards;
  const hasOffensiveSim = activeTab === 'offensive' && Boolean(offensiveResult?.simulated_play);
  const hasDefensiveSim = activeTab === 'defensive' && Boolean(defensiveResult?.simulated_defense);

  if (hasOffensiveSim && offensiveResult?.simulated_play) {
    simYards = offensiveResult.simulated_play.expected_yards;
  } else if (hasDefensiveSim && defensiveResult?.simulated_defense) {
    simYards = defensiveResult.simulated_defense.expected_yards_allowed;
  }
  const simEndX = getYardX(play.yardline_100 - simYards);

  // Marcas de yarda
  const yardMarkers = [
    { x: 180, label: '10' },
    { x: 260, label: '20' },
    { x: 340, label: '30' },
    { x: 420, label: '40' },
    { x: 500, label: '50' },
    { x: 580, label: '40' },
    { x: 660, label: '30' },
    { x: 740, label: '20' },
    { x: 820, label: '10' },
  ];

  // CORREGIDO: Arreglo de posiciones completado con tipado explícito
  const grassStripes: number[] = [100, 180, 260, 340, 420, 500, 580, 660, 740, 820];

  return (
    <div className="w-full bg-[#0b1329] border border-[#1a2647] p-5 rounded-2xl shadow-xl space-y-4">
      {/* Encabezado del Campo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#1a2647] pb-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>🏟️</span> Campo de Juego — Visualización Espacial Real vs Simulado
          </h3>
          <p className="text-xs text-gray-400">
            Representación contrafactual estocástica de trayectorias ({activeTab === 'offensive' ? 'Enfoque Ofensivo' : 'Enfoque Defensivo'})
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Scrimmage ({play.yardline_100} yds)
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> 1er Down ({play.ydstogo} yds)
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Real ({actualYards} yds)
          </span>
          {(hasOffensiveSim || hasDefensiveSim) && (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Simulado ({simYards} yds)
            </span>
          )}
        </div>
      </div>

      {/* Emparrillado SVG 2D */}
      <div className="relative w-full h-[320px] sm:h-[360px] overflow-hidden rounded-xl border border-emerald-900/60 bg-[#143d22] shadow-2xl flex items-center justify-center">
        <svg viewBox="0 0 1000 400" preserveAspectRatio="none" className="w-full h-full select-none">
          {/* Fondo de pasto verde */}
          <rect x="0" y="0" width="1000" height="400" fill="#143d22" />

          {/* Franjas alternadas de pasto */}
          {grassStripes.map((x: number) => (
            <rect key={x} x={x} y="0" width="80" height="400" fill="#184728" opacity="0.5" />
          ))}

          {/* Endzone Izquierda (HOME) */}
          <rect x="0" y="0" width="100" height="400" fill="#0f331c" />
          <text x="50" y="200" fill="#ffffff" fontSize="26" fontWeight="black" textAnchor="middle" transform="rotate(-90 50 200)" opacity="0.35" letterSpacing="4">
            ENDZONE
          </text>

          {/* Endzone Derecha (AWAY) */}
          <rect x="900" y="0" width="100" height="400" fill="#0f331c" />
          <text x="950" y="200" fill="#ffffff" fontSize="26" fontWeight="black" textAnchor="middle" transform="rotate(90 950 200)" opacity="0.35" letterSpacing="4">
            ENDZONE
          </text>

          {/* Líneas de Yarda y Números */}
          {yardMarkers.map((m) => (
            <g key={m.x}>
              <line x1={m.x} y1="0" x2={m.x} y2="400" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.3" />
              <text x={m.x} y="35" fill="#ffffff" fontSize="18" fontFamily="monospace" fontWeight="bold" textAnchor="middle" opacity="0.6">
                {m.label}
              </text>
              <text x={m.x} y="375" fill="#ffffff" fontSize="18" fontFamily="monospace" fontWeight="bold" textAnchor="middle" opacity="0.6" transform={`rotate(180 ${m.x} 375)`}>
                {m.label}
              </text>
            </g>
          ))}

          {/* Hashes centrales */}
          <line x1="100" y1="200" x2="900" y2="200" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="8 8" strokeOpacity="0.3" />

          {/* 1. Línea de Scrimmage (Azul) */}
          <line x1={startX} y1="20" x2={startX} y2="380" stroke="#3b82f6" strokeWidth="5" strokeDasharray="6 4" />

          {/* 2. Línea de Primer Down (Amarilla) */}
          <line x1={firstDownX} y1="20" x2={firstDownX} y2="380" stroke="#f59e0b" strokeWidth="4" />

          {/* Icono QB */}
          <circle cx={startX} cy="200" r="14" fill="#3b82f6" stroke="#ffffff" strokeWidth="3" />
          <text x={startX} y="204" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">QB</text>

          {/* Vector Real (Trayectoria Roja) */}
          <g>
            <path
              d={`M ${startX} 200 Q ${(startX + actualEndX) / 2} 120 ${actualEndX} 150`}
              fill="none"
              stroke="#ef4444"
              strokeWidth="4"
              strokeDasharray="6 4"
            />
            <circle cx={actualEndX} cy="150" r="12" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
            <text x={actualEndX} y="154" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">WR1</text>
            <text x={actualEndX} y="125" fill="#fca5a5" fontSize="13" fontWeight="bold" textAnchor="middle">
              Real: {actualYards} yds
            </text>
          </g>

          {/* Vector Simulado (Trayectoria Verde) */}
          {(hasOffensiveSim || hasDefensiveSim) && (
            <g>
              <path
                d={`M ${startX} 200 Q ${(startX + simEndX) / 2} 280 ${simEndX} 250`}
                fill="none"
                stroke="#10b981"
                strokeWidth="5"
              />
              <circle cx={simEndX} cy="250" r="13" fill="#10b981" stroke="#ffffff" strokeWidth="3" className="animate-pulse" />
              <text x={simEndX} y="254" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">SIM</text>
              <text x={simEndX} y="285" fill="#6ee7b7" fontSize="14" fontWeight="bold" textAnchor="middle">
                Simulado: {simYards} yds
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
