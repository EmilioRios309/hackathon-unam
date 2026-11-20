import React, { useEffect, useRef, useState } from 'react';
import { getJSON, postJSON } from '../api';

interface Suggestion {
  id: string;
  label: string;
  needs_play?: boolean;
}
interface Msg {
  role: 'user' | 'bot';
  text: string;
  source?: 'datos' | 'ia' | 'aviso';
}

// Asistente flotante: preguntas rápidas calculadas con los datos (siempre funcionan) y preguntas libres con IA (opcional).
export const AssistantPanel: React.FC<{ play: { gameId: number; playId: number } | null }> = ({ play }) => {
  const [open, setOpen] = useState(false);
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'bot', text: 'Hola. Elige una pregunta rápida o escribe la tuya sobre presión, pass rush, QBs o la jugada que estás viendo.', source: 'aviso' },
  ]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getJSON<Suggestion[]>('api/assistant/suggestions')
      .then(setSugs)
      .catch(() => setSugs([]));
  }, []);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, open]);

  const send = (body: { question?: string; intent?: string }, label: string) => {
    setMsgs((m) => [...m, { role: 'user', text: label }]);
    setBusy(true);
    postJSON<{ available: boolean; text: string | null; source: 'datos' | 'ia' }>('api/assistant', { ...body, ...(play ?? {}) })
      .then((d) =>
        setMsgs((m) => [
          ...m,
          d.available && d.text
            ? { role: 'bot', text: d.text, source: d.source }
            : { role: 'bot', text: 'La IA no está disponible ahora. Las preguntas rápidas sí funcionan porque se calculan directo de los datos.', source: 'aviso' },
        ]),
      )
      .catch(() => setMsgs((m) => [...m, { role: 'bot', text: 'No pude conectar con el servidor.', source: 'aviso' }]))
      .finally(() => setBusy(false));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (!text || busy) return;
    setQ('');
    send({ question: text }, text);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 h-12 px-5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-xl shadow-blue-900/40 hover:brightness-110"
        >
          💬 Pregúntale a los datos
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[min(420px,calc(100vw-2.5rem))] h-[min(600px,calc(100vh-2.5rem))] flex flex-col bg-[#0b1329] border border-[#1a2647] rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2647]">
            <div>
              <p className="text-sm font-bold text-white">Asistente de Pressure Lab</p>
              <p className="text-[11px] text-gray-500">{play ? `Contexto: jugada ${play.playId} del juego ${play.gameId}` : 'Sin jugada seleccionada'}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-lg px-2" aria-label="Cerrar">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                    m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-[#070d1e] border border-[#1a2647] text-gray-200'
                  }`}
                >
                  {m.text}
                  {m.role === 'bot' && m.source && m.source !== 'aviso' && (
                    <span className="block mt-1 text-[10px] text-gray-500">{m.source === 'datos' ? 'Calculado con los datos' : 'IA (Amazon Bedrock Nova) con consultas a los datos'}</span>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-gray-500 animate-pulse px-1">Pensando…</p>}
            <div ref={end} />
          </div>

          <div className="px-3 pt-2 flex flex-wrap gap-1.5 border-t border-[#1a2647]">
            {sugs
              .filter((s) => !s.needs_play || play)
              .map((s) => (
                <button
                  key={s.id}
                  disabled={busy}
                  onClick={() => send({ intent: s.id }, s.label)}
                  className="text-[11px] px-2 py-1 rounded-full border border-[#1a2647] text-gray-300 hover:bg-[#152042] disabled:opacity-40"
                >
                  {s.label}
                </button>
              ))}
          </div>
          <form onSubmit={submit} className="p-3 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={500}
              placeholder="Ej. ¿Cómo le va a Mahomes bajo presión?"
              className="flex-1 bg-[#070d1e] border border-[#1a2647] rounded-lg px-3 py-2 text-xs text-gray-100"
            />
            <button disabled={busy || !q.trim()} className="px-3 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-40">
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  );
};
