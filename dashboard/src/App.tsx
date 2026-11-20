import React, { useEffect, useState } from 'react';
import { getJSON, num, pct } from './api';
import { Summary } from './types';
import { SummaryView } from './components/SummaryView';
import { TrenchesView } from './components/TrenchesView';
import { QBView } from './components/QBView';
import { SimulatorView } from './components/SimulatorView';
import { MethodologyView } from './components/MethodologyView';
import { ErrorBox, Loading } from './components/ui';

type Tab = 'summary' | 'simulator' | 'trenches' | 'qbs' | 'method';

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: '📊 Resumen' },
  { id: 'simulator', label: '🎮 Simulador de presión' },
  { id: 'trenches', label: '🧱 Pass rush vs línea' },
  { id: 'qbs', label: '🎯 QB bajo presión' },
  { id: 'method', label: '📐 Metodología' },
];

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('summary');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJSON<Summary>('api/summary')
      .then(setSummary)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="w-full min-h-screen bg-[#070d1e] text-gray-100 p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1800px] mx-auto">
      <header className="w-full bg-[#0b1329] border border-[#1a2647] p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center text-2xl">🏈</div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">NFL Pressure Lab</h1>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Quién genera la presión, quién la permite y cuánto cuesta. Temporada 2021, semanas 1 a 8 (datos PFF).
            </p>
          </div>
        </div>
        {summary && (
          <p className="text-sm text-gray-300 max-w-md">
            Con presión el QB pierde <b className="text-orange-400">{num(Math.abs(summary.kpis.pressure_cost_ypa), 1)} yardas por intento</b> y su % de
            completos baja de {pct(summary.by_pressure[0].comp_pct, 0)} a {pct(summary.by_pressure[1].comp_pct, 0)}.
          </p>
        )}
      </header>

      <nav className="flex flex-wrap gap-1 bg-[#0b1329] p-1.5 rounded-2xl border border-[#1a2647]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[150px] py-2.5 px-4 text-xs sm:text-sm font-bold rounded-xl transition ${
              tab === t.id ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#152042]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error && <ErrorBox error={error} />}
      {!error && !summary && <Loading text="Calculando métricas…" />}
      {summary && tab === 'summary' && <SummaryView s={summary} />}
      {tab === 'simulator' && <SimulatorView />}
      {tab === 'trenches' && <TrenchesView />}
      {summary && tab === 'qbs' && <QBView s={summary} />}
      {summary && tab === 'method' && <MethodologyView s={summary} />}
    </div>
  );
};

export default App;
