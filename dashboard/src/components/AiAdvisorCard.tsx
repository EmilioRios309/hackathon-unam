import React from 'react';

interface AiAdvisorCardProps {
  summary?: string;
}

export const AiAdvisorCard: React.FC<AiAdvisorCardProps> = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-950/80 via-purple-950/50 to-gray-900 border border-indigo-500/30 p-4 rounded-xl shadow-lg relative overflow-hidden">
      {/* Resplandor decorativo */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 text-base">🤖</span>
          <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
            Diagnóstico Ejecutivo de IA (Amazon Bedrock)
          </h4>
        </div>
        <span className="text-[10px] font-mono bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/50">
          Nova / Resiliente
        </span>
      </div>

      <p className="text-xs text-gray-200 leading-relaxed font-medium pl-6">
        {summary}
      </p>
    </div>
  );
};