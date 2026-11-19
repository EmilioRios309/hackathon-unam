import React, { useEffect, useState } from 'react';
import { PlayTimeline } from './components/PlayTimeline';
import { OffensiveSimulatorPanel } from './components/OffensiveSimulatorPanel';
import { DefensiveSimulatorPanel } from './components/DefensiveSimulatorPanel';
import { RechartsComparisonView } from './components/RechartsComparisonView';
import { Field2DView } from './components/Field2DView';
import { Play, OffensiveSimResult, DefensiveSimResult } from './types';

export const App: React.FC = () => {
  const [plays, setPlays] = useState<Play[]>([]);
  const [selectedPlay, setSelectedPlay] = useState<Play | null>(null);
  const [offensiveResult, setOffensiveResult] = useState<OffensiveSimResult | null>(null);
  const [defensiveResult, setDefensiveResult] = useState<DefensiveSimResult | null>(null);
  const [loadingPlays, setLoadingPlays] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'offensive' | 'defensive'>('offensive');

  useEffect(() => {
    fetch('api/plays')
      .then((res) => {
        if (!res.ok) throw new Error('Error al cargar jugadas');
        return res.json();
      })
      .then((data: Play[]) => {
        setPlays(data);
        if (data.length > 0) {
          // CORREGIDO: Seleccionar la primera jugada (data[0])
          setSelectedPlay(data[0]);
        }
      })
      .catch((err) => console.error('Error conectando con la API:', err))
      .finally(() => setLoadingPlays(false));
  }, []);

  const handleSelectPlay = (play: Play) => {
    setSelectedPlay(play);
    setOffensiveResult(null);
    setDefensiveResult(null);
  };

  return (
    <div className="w-full min-h-screen bg-[#070d1e] text-gray-100 p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1800px] mx-auto">
      {/* Header Estilo Consola Analítica Pro */}
      <header className="w-full bg-[#0b1329] border border-[#1a2647] p-5 rounded-2xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-blue-500/20">
            🏈
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                NFL Counterfactual Play Simulator
              </h1>
              <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-500/30">
                v1.2 Pro
              </span>
            </div>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              NFL Big Data Bowl 2026 — Spatial Probability & What-If Tactical Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono bg-emerald-950/80 text-emerald-400 px-3.5 py-1.5 rounded-xl border border-emerald-800/80 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            FastAPI + React
          </span>
          <span className="text-xs font-mono bg-amber-950/80 text-amber-300 px-3.5 py-1.5 rounded-xl border border-amber-800/80 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            AWS Bedrock Ready
          </span>
        </div>
      </header>

      {/* Catálogo de Jugadas Clave */}
      {loadingPlays ? (
        <div className="w-full bg-[#0b1329] border border-[#1a2647] p-8 rounded-2xl text-center text-gray-400 animate-pulse text-sm">
          Cargando catálogo de jugadas en memoria...
        </div>
      ) : (
        <PlayTimeline
          plays={plays}
          selectedPlay={selectedPlay}
          onSelectPlay={handleSelectPlay}
        />
      )}

      {/* Distribución Principal en 2 Columnas */}
      {selectedPlay && (
        <main className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda (7 Cols): Campo 2D + Gráficos Comparativos */}
          <div className="lg:col-span-7 space-y-6">
            <Field2DView
              play={selectedPlay}
              offensiveResult={offensiveResult}
              defensiveResult={defensiveResult}
              activeTab={activeTab}
            />

            <RechartsComparisonView
              offensiveResult={offensiveResult}
              defensiveResult={defensiveResult}
              activeTab={activeTab}
            />
          </div>

          {/* Columna Derecha (5 Cols): Panel Contrafactual + Selector */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex bg-[#0b1329] p-1.5 rounded-2xl border border-[#1a2647]">
              <button
                onClick={() => setActiveTab('offensive')}
                className={`flex-1 py-3 px-4 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'offensive'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-[#152042]'
                }`}
              >
                <span>⚡</span> Enfoque Ofensivo
              </button>
              <button
                onClick={() => setActiveTab('defensive')}
                className={`flex-1 py-3 px-4 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'defensive'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-[#152042]'
                }`}
              >
                <span>🛡️</span> Enfoque Defensivo
              </button>
            </div>

            {/* Handlers Correctos para Ofensiva y Defensiva */}
            {activeTab === 'offensive' ? (
              <OffensiveSimulatorPanel
                play={selectedPlay}
                onSimulate={(res) => setOffensiveResult(res)}
              />
            ) : (
              <DefensiveSimulatorPanel
                play={selectedPlay}
                onSimulate={(res) => setDefensiveResult(res)}
              />
            )}
          </div>
        </main>
      )}
    </div>
  );
};

export default App;