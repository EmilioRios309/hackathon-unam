import React, { useEffect, useState } from 'react';
import { PlayTimeline } from './components/PlayTimeLine';
import { OffensiveSimulatorPanel } from './components/OffensiveSimulatorPanel';
import { DefensiveSimulatorPanel } from './components/DefensiveSimulatorPanel';
import { RechartsComparisonView } from './components/RechartsComparisonView';
import { Play, OffensiveSimResult, DefensiveSimResult } from './types';

export const App: React.FC = () => {
  const [plays, setPlays] = useState<Play[]>([]);
  const [selectedPlay, setSelectedPlay] = useState<Play | null>(null);
  const [offensiveResult, setOffensiveResult] = useState<OffensiveSimResult | null>(null);
  const [defensiveResult, setDefensiveResult] = useState<DefensiveSimResult | null>(null);
  const [loadingPlays, setLoadingPlays] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'offensive' | 'defensive'>('offensive');

  // Carga inicial del catálogo de jugadas desde el backend
  useEffect(() => {
    // OBLIGATORIO: Ruta relativa sin diagonal inicial
    fetch('api/plays')
      .then((res) => {
        if (!res.ok) throw new Error('Error al cargar jugadas');
        return res.json();
      })
      .then((data: Play[]) => {
        setPlays(data);
        if (data.length > 0) {
          setSelectedPlay(data[0]);
        }
      })
      .catch((err) => console.error('Error conectando con la API:', err))
      .finally(() => setLoadingPlays(false));
  }, []);

  // Limpiar resultados simulados al cambiar de jugada
  const handleSelectPlay = (play: Play) => {
    setSelectedPlay(play);
    setOffensiveResult(null);
    setDefensiveResult(null);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-6 lg:p-8">
      {/* Header de la Aplicación */}
      <header className="mb-6 pb-4 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏈</span>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Simulador Contrafactual NFL
              </h1>
              <p className="text-xs text-gray-400 font-medium">
                Apoyo a la Toma de Decisiones Tácticas para Entrenadores ("What-If")
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono bg-emerald-950 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-800/80 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Backend Conectado
          </span>
          <span className="text-xs font-mono bg-gray-900 text-gray-400 px-3 py-1.5 rounded-lg border border-gray-800">
            Hackathon UNAM
          </span>
        </div>
      </header>

      {/* Línea de Tiempo de Jugadas */}
      {loadingPlays ? (
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl text-center text-gray-400 animate-pulse mb-6">
          Cargando catálogo de jugadas en memoria...
        </div>
      ) : (
        <PlayTimeline
          plays={plays}
          selectedPlay={selectedPlay}
          onSelectPlay={handleSelectPlay}
        />
      )}

      {/* Sección de Simulación y Visualización */}
      {selectedPlay && (
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Selector y Controles Tácticos (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Tab Selector de Enfoque (Ofensivo vs Defensivo) */}
            <div className="flex bg-gray-900 p-1.5 rounded-xl border border-gray-800">
              <button
                onClick={() => setActiveTab('offensive')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'offensive'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                ⚡ Enfoque Ofensivo
              </button>
              <button
                onClick={() => setActiveTab('defensive')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'defensive'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                🛡️ Enfoque Defensivo
              </button>
            </div>

            {/* Panel según Tab Activo */}
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

          {/* Columna Derecha: Gráficos y Diagnóstico (7 cols) */}
          <div className="lg:col-span-7">
            <RechartsComparisonView
              offensiveResult={offensiveResult}
              defensiveResult={defensiveResult}
            />
          </div>
        </main>
      )}
    </div>
  );
};

export default App;