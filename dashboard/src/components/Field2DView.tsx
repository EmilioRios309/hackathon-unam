import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getJSON, num } from '../api';
import { FramePlayer, PlayFrames } from '../types';
import { COLORS, tooltipStyle } from './ui';

// Vista "desde la zona de anotación": la ofensiva avanza hacia arriba.
const U = 10; // unidades SVG por yarda
const FIELD_W = 53.3;
const BEHIND = 13; // yardas visibles detrás de la línea de scrimmage
const AHEAD = 22; // yardas visibles delante

export const ROLE_STYLE: Record<FramePlayer['role'], { fill: string; text: string; label: string }> = {
  Pass: { fill: '#ffffff', text: '#0f172a', label: 'QB' },
  'Pass Block': { fill: '#3b82f6', text: '#ffffff', label: 'Protección' },
  'Pass Route': { fill: '#93c5fd', text: '#0f172a', label: 'Receptores' },
  'Pass Rush': { fill: '#f97316', text: '#ffffff', label: 'Pass rush' },
  Coverage: { fill: '#64748b', text: '#ffffff', label: 'Cobertura' },
  Otro: { fill: '#475569', text: '#ffffff', label: 'Otro' },
};

const threatColor = (d: number) => (d < 2 ? '#ef4444' : d < 3 ? '#f59e0b' : '#22c55e');

interface Props {
  gameId: number;
  playId: number;
  highlight: number | null; // nflId
  onHighlight: (nflId: number | null) => void;
}

export const Field2DView: React.FC<Props> = ({ gameId, playId, highlight, onHighlight }) => {
  const [data, setData] = useState<PlayFrames | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [k, setK] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [trails, setTrails] = useState(true);
  const [duels, setDuels] = useState(false);
  const [numbers, setNumbers] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    setPlaying(false);
    getJSON<PlayFrames>(`api/play-frames?gameId=${gameId}&playId=${playId}`)
      .then((d) => {
        setData(d);
        setK(0);
        setPlaying(true);
      })
      .catch((e: Error) => setError(e.message));
  }, [gameId, playId]);

  useEffect(() => {
    if (!playing || !data) return;
    timer.current = window.setInterval(() => {
      setK((x) => {
        if (x >= data.frames.length - 1) {
          setPlaying(false);
          return x;
        }
        return x + 1;
      });
    }, 100 / speed);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, speed, data]);

  const geo = useMemo(() => {
    if (!data) return null;
    const xMax = Math.min(data.los + AHEAD, 120);
    const xMin = Math.max(xMax - BEHIND - AHEAD, 0);
    const sx = (y: number) => (FIELD_W - y) * U;
    const sy = (x: number) => (xMax - x) * U;
    const snapIdx = Math.max(0, data.frames.findIndex((f) => f.t >= 0));
    const endIdx = Math.max(snapIdx, data.frames.findIndex((f) => f.t >= data.end_t));
    const firstClose = data.qb_dist.find((q) => q.d <= data.close_yd);
    return { xMax, xMin, sx, sy, H: (xMax - xMin) * U, W: FIELD_W * U, snapIdx, endIdx, firstClose };
  }, [data]);

  if (error) return <div className="h-[420px] flex items-center justify-center text-sm text-gray-500">Sin tracking para esta jugada ({error}).</div>;
  if (!data || !geo) return <div className="h-[420px] flex items-center justify-center text-sm text-gray-500 animate-pulse">Cargando tracking…</div>;

  const frame = data.frames[Math.min(k, data.frames.length - 1)];
  const { sx, sy, W, H } = geo;
  const t = frame.t;
  const qbPos = data.qb !== null ? frame.p[data.qb] : null;
  const threat = t >= 0 && t <= data.end_t ? [...data.qb_dist].reverse().find((q) => q.t <= t) : undefined;
  const hlIdx = highlight !== null ? data.players.find((p) => p.nflId === highlight)?.i ?? null : null;
  const focus = hover ?? hlIdx;
  const phase = t < 0 ? 'Antes del snap' : t <= data.end_t ? `${num(t, 1)} s tras el snap` : `${data.end_label} a los ${num(data.end_t, 1)} s`;

  // Trayectorias desde el snap para QB y pass rush
  const trailIdx = data.players.filter((p) => p.role === 'Pass Rush' || p.role === 'Pass').map((p) => p.i);
  const trailFrames = data.frames.slice(geo.snapIdx, Math.max(geo.snapIdx, k) + 1);

  // Líneas de yardas visibles
  const lines: number[] = [];
  for (let x = Math.ceil(geo.xMin / 5) * 5; x <= geo.xMax; x += 5) if (x >= 10 && x <= 110) lines.push(x);

  const protagonists = new Set(data.players.filter((p) => p.hit || p.hurry || p.sack || p.beaten).map((p) => p.i));
  const jump = (tt: number) => {
    setPlaying(false);
    const i = data.frames.findIndex((f) => f.t >= tt);
    setK(i < 0 ? data.frames.length - 1 : i);
  };

  return (
    <div className="space-y-3">
      {/* Estado */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-white bg-[#070d1e] border border-[#1a2647] rounded-full px-3 py-1">{phase}</span>
        {threat ? (
          <span className="flex items-center gap-2">
            <span className="text-gray-400">Rusher más cercano al QB:</span>
            <span className="font-semibold text-gray-100">{data.players[threat.who]?.name}</span>
            <span className="font-mono font-bold px-2 py-0.5 rounded" style={{ background: threatColor(threat.d), color: '#0f172a' }}>
              {num(threat.d, 1)} yd
            </span>
          </span>
        ) : (
          <span className="text-gray-500">La distancia al QB se mide del snap al {data.end_label.toLowerCase()}</span>
        )}
      </div>

      {/* Campo */}
      <div className="rounded-xl overflow-hidden border border-[#1a2647] bg-[#0b2417]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block select-none" onMouseLeave={() => setHover(null)}>
          <rect x={0} y={0} width={W} height={H} fill="#0b2417" />
          {geo.xMax > 110 && <rect x={0} y={0} width={W} height={sy(110)} fill="#123524" />}
          {lines.map((x) => (
            <g key={x}>
              <line x1={0} x2={W} y1={sy(x)} y2={sy(x)} stroke="#ffffff" strokeOpacity={x % 10 === 0 ? 0.18 : 0.08} />
              {x % 10 === 0 && x > 10 && x < 110 && (
                <>
                  <text x={22} y={sy(x) + 5} fill="#ffffff" fillOpacity={0.3} fontSize={14} fontWeight={700}>
                    {x <= 60 ? x - 10 : 110 - x}
                  </text>
                  <text x={W - 22} y={sy(x) + 5} fill="#ffffff" fillOpacity={0.3} fontSize={14} fontWeight={700} textAnchor="end">
                    {x <= 60 ? x - 10 : 110 - x}
                  </text>
                </>
              )}
            </g>
          ))}
          {/* Línea de scrimmage y primera oportunidad */}
          <line x1={0} x2={W} y1={sy(data.los)} y2={sy(data.los)} stroke="#60a5fa" strokeWidth={2.5} strokeOpacity={0.9} />
          {data.first_down <= geo.xMax && (
            <line x1={0} x2={W} y1={sy(data.first_down)} y2={sy(data.first_down)} stroke="#facc15" strokeWidth={2.5} strokeOpacity={0.9} />
          )}

          {/* Zona de presión alrededor del QB */}
          {qbPos && t >= 0 && t <= data.end_t && (
            <circle
              cx={sx(qbPos[1])}
              cy={sy(qbPos[0])}
              r={data.close_yd * U}
              fill="#ef4444"
              fillOpacity={threat && threat.d < data.close_yd ? 0.28 : 0.07}
              stroke="#ef4444"
              strokeOpacity={0.6}
              strokeDasharray="5 4"
            />
          )}

          {/* Trayectorias */}
          {trails &&
            trailIdx.map((i) => {
              const pts = trailFrames.map((f) => f.p[i]).filter(Boolean) as [number, number, number][];
              if (pts.length < 2) return null;
              const role = data.players[i].role;
              return (
                <polyline
                  key={`tr${i}`}
                  points={pts.map((p) => `${sx(p[1])},${sy(p[0])}`).join(' ')}
                  fill="none"
                  stroke={ROLE_STYLE[role].fill}
                  strokeOpacity={focus === null || focus === i ? 0.55 : 0.15}
                  strokeWidth={2}
                />
              );
            })}

          {/* Duelos de bloqueo */}
          {duels &&
            data.players
              .filter((p) => p.role === 'Pass Block' && p.blocked !== null)
              .map((p) => {
                const a = frame.p[p.i];
                const b = frame.p[p.blocked as number];
                if (!a || !b) return null;
                return (
                  <line
                    key={`d${p.i}`}
                    x1={sx(a[1])}
                    y1={sy(a[0])}
                    x2={sx(b[1])}
                    y2={sy(b[0])}
                    stroke={p.beaten ? '#ef4444' : '#e5e7eb'}
                    strokeOpacity={0.7}
                    strokeWidth={p.beaten ? 2.5 : 1.5}
                    strokeDasharray={p.beaten ? undefined : '3 3'}
                  />
                );
              })}

          {/* Amenaza: QB → rusher más cercano */}
          {threat && qbPos && frame.p[threat.who] && (
            <g>
              <line
                x1={sx(qbPos[1])}
                y1={sy(qbPos[0])}
                x2={sx(frame.p[threat.who]![1])}
                y2={sy(frame.p[threat.who]![0])}
                stroke={threatColor(threat.d)}
                strokeWidth={3}
              />
              <text
                x={(sx(qbPos[1]) + sx(frame.p[threat.who]![1])) / 2 + 8}
                y={(sy(qbPos[0]) + sy(frame.p[threat.who]![0])) / 2}
                fill={threatColor(threat.d)}
                fontSize={13}
                fontWeight={800}
                stroke="#0b2417"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {num(threat.d, 1)} yd
              </text>
            </g>
          )}

          {/* Jugadores */}
          {data.players.map((p) => {
            const pos = frame.p[p.i];
            if (!pos) return null;
            const st = ROLE_STYLE[p.role];
            const dim = focus !== null && focus !== p.i;
            const cx = sx(pos[1]);
            const cy = sy(pos[0]);
            return (
              <g
                key={p.i}
                opacity={dim ? 0.45 : 1}
                onMouseEnter={() => setHover(p.i)}
                onClick={() => onHighlight(highlight === p.nflId ? null : p.nflId)}
                className="cursor-pointer"
              >
                {protagonists.has(p.i) && <circle cx={cx} cy={cy} r={13.5} fill="none" stroke="#ef4444" strokeWidth={2.5} />}
                <circle cx={cx} cy={cy} r={9} fill={st.fill} stroke={focus === p.i ? '#facc15' : '#0b2417'} strokeWidth={focus === p.i ? 3 : 1.5} />
                {numbers && p.jersey !== null && (
                  <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={9} fontWeight={800} fill={st.text} pointerEvents="none">
                    {p.jersey}
                  </text>
                )}
              </g>
            );
          })}

          {/* Balón */}
          {frame.ball && <ellipse cx={sx(frame.ball[1])} cy={sy(frame.ball[0])} rx={3.5} ry={5} fill="#b45309" stroke="#fde68a" strokeWidth={1} />}

          {/* Etiqueta del jugador enfocado */}
          {focus !== null &&
            frame.p[focus] &&
            (() => {
              const p = data.players[focus];
              const pos = frame.p[focus]!;
              const label = `${p.name} · ${p.pos}${p.sack ? ' · sack' : p.hit ? ' · hit' : p.hurry ? ' · hurry' : p.beaten ? ' · vencido' : ''}`;
              const w = label.length * 6.6 + 14;
              const x = Math.min(Math.max(sx(pos[1]) - w / 2, 4), W - w - 4);
              const y = Math.max(sy(pos[0]) - 34, 4);
              return (
                <g pointerEvents="none">
                  <rect x={x} y={y} width={w} height={20} rx={6} fill="#020617" fillOpacity={0.9} stroke="#334155" />
                  <text x={x + 7} y={y + 14} fontSize={11.5} fill="#f1f5f9" fontWeight={600}>
                    {label}
                  </text>
                </g>
              );
            })()}
        </svg>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            if (k >= data.frames.length - 1) setK(0);
            setPlaying(!playing);
          }}
          className="w-20 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
        >
          {playing ? '❚❚ Pausa' : '▶ Play'}
        </button>
        <button onClick={() => jump(0)} className="h-8 px-3 rounded-lg border border-[#1a2647] text-xs text-gray-300 hover:bg-[#152042]">
          Snap
        </button>
        {geo.firstClose && (
          <button onClick={() => jump(geo.firstClose!.t)} className="h-8 px-3 rounded-lg border border-red-900 text-xs text-red-300 hover:bg-red-950/50">
            Llega la presión ({num(geo.firstClose.t, 1)} s)
          </button>
        )}
        <button onClick={() => jump(data.end_t)} className="h-8 px-3 rounded-lg border border-[#1a2647] text-xs text-gray-300 hover:bg-[#152042]">
          {data.end_label} ({num(data.end_t, 1)} s)
        </button>
        <div className="flex rounded-lg border border-[#1a2647] overflow-hidden ml-auto">
          {[0.5, 1].map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className={`h-8 px-2.5 text-xs ${speed === s ? 'bg-[#152042] text-white font-bold' : 'text-gray-400'}`}>
              {s}x
            </button>
          ))}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={data.frames.length - 1}
        value={k}
        onChange={(e) => {
          setPlaying(false);
          setK(Number(e.target.value));
        }}
        className="w-full accent-blue-500"
      />

      {/* Distancia al QB en el tiempo */}
      {data.qb_dist.length > 1 && (
        <div>
          <p className="text-[11px] text-gray-400 font-semibold mb-1">
            Distancia del rusher más cercano al QB (yd). La franja roja es la zona de presión ({data.close_yd} yd).
          </p>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={data.qb_dist} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="t" type="number" domain={[0, data.end_t]} stroke={COLORS.axis} fontSize={10} tickFormatter={(v: number) => `${v}s`} />
              <YAxis stroke={COLORS.axis} fontSize={10} domain={[0, 'auto']} />
              <ReferenceArea y1={0} y2={data.close_yd} fill="#ef4444" fillOpacity={0.15} />
              <Area type="monotone" dataKey="d" stroke="#f97316" fill="#f97316" fillOpacity={0.15} isAnimationActive={false} />
              {t >= 0 && <ReferenceLine x={Math.min(t, data.end_t)} stroke="#e5e7eb" />}
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => `${num(Number(v), 1)} yd`} labelFormatter={(l: unknown) => `${l} s`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Leyenda y opciones */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-gray-400">
        {(['Pass', 'Pass Block', 'Pass Route', 'Pass Rush', 'Coverage'] as FramePlayer['role'][]).map((r) => (
          <span key={r} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: ROLE_STYLE[r].fill }} />
            {ROLE_STYLE[r].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block border-2 border-red-500" />
          Generó presión o fue vencido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-blue-400 inline-block" /> Scrimmage
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-yellow-400 inline-block" /> 1er down
        </span>
        <span className="ml-auto flex gap-3">
          {(
            [
              ['Trayectorias', trails, setTrails],
              ['Duelos de bloqueo', duels, setDuels],
              ['Números', numbers, setNumbers],
            ] as [string, boolean, (v: boolean) => void][]
          ).map(([l, v, set]) => (
            <label key={l} className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="accent-blue-500" />
              {l}
            </label>
          ))}
        </span>
      </div>
    </div>
  );
};
