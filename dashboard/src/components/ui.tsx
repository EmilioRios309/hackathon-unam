import React from 'react';

export const COLORS = {
  clean: '#38bdf8',
  pressure: '#f97316',
  real: '#a3a3a3',
  expected: '#818cf8',
  simulated: '#22c55e',
  offense: '#3b82f6',
  defense: '#10b981',
  grid: '#1e293b',
  axis: '#94a3b8',
};

export const tooltipStyle = {
  contentStyle: { background: '#0b1329', border: '1px solid #1a2647', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#e5e7eb' },
};

export const Card: React.FC<{ title?: string; subtitle?: string; className?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  className = '',
  children,
}) => (
  <section className={`bg-[#0b1329] border border-[#1a2647] rounded-2xl p-5 ${className}`}>
    {title && <h2 className="text-sm font-bold text-white">{title}</h2>}
    {subtitle && <p className="text-xs text-gray-400 mt-0.5 mb-3">{subtitle}</p>}
    {!subtitle && title && <div className="mb-3" />}
    {children}
  </section>
);

export const Kpi: React.FC<{ label: string; value: string; hint?: string; tone?: 'neutral' | 'good' | 'bad' }> = ({
  label,
  value,
  hint,
  tone = 'neutral',
}) => {
  const color = tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-orange-400' : 'text-white';
  return (
    <div className="bg-[#0b1329] border border-[#1a2647] rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  );
};

export const Loading: React.FC<{ text?: string }> = ({ text = 'Cargando…' }) => (
  <div className="w-full bg-[#0b1329] border border-[#1a2647] p-8 rounded-2xl text-center text-gray-400 animate-pulse text-sm">
    {text}
  </div>
);

export const ErrorBox: React.FC<{ error: string }> = ({ error }) => (
  <div className="w-full bg-red-950/40 border border-red-900 p-4 rounded-2xl text-red-300 text-sm">
    No se pudo cargar la información ({error}). ¿Está corriendo el backend?
  </div>
);

export const Select: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <label className="flex flex-col gap-1 text-[11px] text-gray-400 font-semibold">
    {label}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#070d1e] border border-[#1a2647] rounded-lg px-2 py-1.5 text-xs text-gray-100"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);
