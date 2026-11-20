import React from 'react';
import { num, pct } from '../api';
import { Summary } from '../types';
import { Card } from './ui';

const F: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="block bg-[#070d1e] border border-[#1a2647] rounded-lg px-3 py-2 text-[12px] text-emerald-300 my-2 whitespace-pre-wrap">{children}</code>
);

export const MethodologyView: React.FC<{ s: Summary }> = ({ s }) => {
  const m = s.model;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 text-sm text-gray-300 leading-relaxed">
      <Card title="Datos y población">
        <p>
          Fuente: <code>games</code>, <code>plays</code>, <code>players</code> y <code>pffScoutingData</code> de la temporada {s.population.season}, semanas{' '}
          {s.population.weeks[0]} a {s.population.weeks[1]}. No hay tracking ni EPA. Todas las jugadas son dropbacks de pase.
        </p>
        <p className="mt-2">
          Se analizan {s.population.plays_analyzed.toLocaleString()} de {s.population.plays_total.toLocaleString()} jugadas. Se excluyen{' '}
          {s.population.excluded}. Las yardas son <code>prePenaltyPlayResult</code>.
        </p>
        <p className="mt-2">Los nulos de PFF son estructurales: cada métrica filtra por <code>pff_role</code> y nunca imputa ceros.</p>
      </Card>

      <Card title="Definiciones">
        <F>presión(jugada) = algún rusher con pff_hit, pff_hurry o pff_sack = 1, o passResult = "S"</F>
        <F>éxito = yardas ≥ 40% de lo por avanzar (1º), 60% (2º), 100% (3º y 4º)</F>
        <F>costo de la presión = yardas por intento con presión − yardas por intento sin presión</F>
        <p>
          Liga: {num(s.kpis.pressure_cost_ypa, 2)} yd por intento, IC95 bootstrap ({'1000'} remuestreos) [{num(s.kpis.pressure_cost_ci[0], 2)},{' '}
          {num(s.kpis.pressure_cost_ci[1], 2)}].
        </p>
      </Card>

      <Card title="Métricas de jugador (Empirical Bayes)">
        <F>Pressure Rate = presiones / snaps de Pass Rush</F>
        <F>Pass Block Loss Rate = pff_beatenByDefender / snaps de Pass Block</F>
        <F>{`tasa ajustada = (eventos + k·μ) / (snaps + k)\nk = μ(1−μ)/τ² − 1,  τ² = var(tasas) − media(μ(1−μ)/snaps)`}</F>
        <p>
          El ajuste acerca a la media de la liga a los jugadores con pocos snaps, así que el ranking no premia la suerte de muestras chicas. El IC95 es{' '}
          <code>tasa ± 1.96·√(tasa(1−tasa)/(snaps+k))</code>.
        </p>
      </Card>

      <Card title="Modelo A: probabilidad de presión">
        <p>
          Regresión logística con penalización L2 (λ = 1) ajustada por Newton-Raphson en numpy. Variables: down, yardas por avanzar, yardas a la zona de
          anotación, marcador, segundos restantes, defensores en el box, formación ofensiva, tipo de cobertura y número de rushers (3 a 7).
        </p>
        <p className="mt-2">
          Validación separando por juego ({m.games_test} juegos de prueba, {m.n_test.toLocaleString()} jugadas): AUC <b>{num(m.auc, 3)}</b> (sin rushers{' '}
          {num(m.auc_without_rushers, 3)}), Brier <b>{num(m.brier, 4)}</b> contra {num(m.brier_baseline, 4)} de predecir siempre la tasa base (
          {pct(m.positive_rate)}).
        </p>
        <p className="mt-2 text-gray-400">
          El poder predictivo es modesto. Sin tracking, la presión depende sobre todo de duelos individuales que no se ven antes del snap. El efecto de los
          rushers es una asociación observada, no un experimento.
        </p>
        <ul className="mt-2 text-xs font-mono text-gray-400 grid grid-cols-2 gap-x-4">
          {m.coefficients.map((c) => (
            <li key={c.feature}>
              {c.feature}: {c.coef > 0 ? '+' : ''}
              {c.coef.toFixed(3)}
            </li>
          ))}
        </ul>
      </Card>

      {s.has_tracking && (
        <Card title="Tracking (10 cuadros por segundo)">
          <p>
            {s.population.with_tracking.toLocaleString()} de {s.population.plays_analyzed.toLocaleString()} jugadas tienen tracking con snap. Las coordenadas
            se normalizan para que la ofensiva siempre avance en la misma dirección.
          </p>
          <F>{`tiempo hasta lanzar (TTT) = cuadro del lanzamiento, sack o carrera del QB − cuadro del snap
distancia de presión = mín. distancia rusher–QB (yd) entre el snap y el lanzamiento
llega a 2 yd = el rusher entra en un radio de 2 yd del QB antes del lanzamiento
salida = velocidad máxima del rusher en el primer segundo (yd/s)`}</F>
          <p>
            Validación: la distancia mínima rusher–QB predice la presión marcada por PFF con AUC <b>{num(m.tracking_check_auc, 3)}</b>. Las air yards no se
            usan porque solo unos 400 pases tienen el evento de llegada del balón.
          </p>
        </Card>
      )}

      {m.release_model && (
        <Card title="Modelo B: presión con tiempo hasta lanzar">
          <p>
            Igual que el modelo A, más el tramo de TTT (menos de 2.5 s, de 2.5 a 3.5 s, más de 3.5 s). Validación por juego: AUC{' '}
            <b>{num(m.release_model.auc, 3)}</b>, Brier <b>{num(m.release_model.brier, 4)}</b> contra {num(m.release_model.brier_baseline, 4)} de la tasa
            base.
          </p>
          <p className="mt-2 text-gray-400">
            El TTT se conoce después del snap y también es efecto de la presión: un QB presionado tarda más. El simulador lo usa como palanca de &quot;qué
            hubiera pasado&quot;. No es un predictor previo al snap.
          </p>
        </Card>
      )}

      <Card title="Simulador contrafactual" className="xl:col-span-2">
        <F>{`P_sim = 1 (forzar presión) | 0 (bolsa limpia) | modelo A con los rushers elegidos
resultado_sim = P_sim · R(presión, celda) + (1 − P_sim) · R(sin presión, celda)
esperado      = mismo cálculo con P = modelo A con los rushers reales`}</F>
        <p>
          <code>R</code> son las tasas observadas en la liga (completo, incompleto, intercepción, sack, scramble, éxito y yardas medias) para la celda{' '}
          <i>presión × down × distancia × tipo de cobertura</i>. Cada celda se encoge hacia su nivel superior con 30 pseudo-jugadas:
        </p>
        <F>R_celda = (suma_celda + 30 · R_padre) / (n_celda + 30)</F>
        <p>
          La jerarquía es presión → down y distancia → cobertura. <b>Real</b> es lo que pasó (0 o 1 en las tasas). <b>Esperado</b> es lo que la liga logra
          en esa situación. <b>Simulado</b> es el escenario elegido. La diferencia simulado − esperado aísla el efecto de cambiar la presión. Las
          perspectivas ofensiva y defensiva usan los mismos números: lo que gana una lo pierde la otra.
        </p>
        <p className="mt-2 text-gray-400">
          Limitaciones: solo 8 semanas de una temporada. No hay datos de rutas, separación ni tiempo hasta lanzar. Las celdas con pocas jugadas dependen
          del nivel superior. La IA (Amazon Bedrock Nova) solo redacta la explicación y nunca cambia los números.
        </p>
      </Card>
    </div>
  );
};
