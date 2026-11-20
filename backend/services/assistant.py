"""Asistente de datos.

- Preguntas rápidas: respuestas deterministas calculadas con los datos (funcionan sin IA).
- Preguntas libres: agente de Strands con Amazon Bedrock (Nova) y herramientas que consultan el motor.
  Si la IA no está disponible, se responde con un aviso y se sugieren las preguntas rápidas.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Callable

import pandas as pd

logger = logging.getLogger("nfl.assistant")

SUGGESTIONS = [
    {"id": "cost", "label": "¿Cuánto cuesta la presión?"},
    {"id": "clock", "label": "¿Lanzar rápido evita la presión?"},
    {"id": "rushers", "label": "¿Quiénes son los mejores pass rushers?"},
    {"id": "blitz", "label": "¿Conviene mandar blitz?"},
    {"id": "qb_fast", "label": "¿Qué QB lanza más rápido?"},
    {"id": "team_ol", "label": "¿Qué línea ofensiva protege mejor?"},
    {"id": "play", "label": "Explícame esta jugada", "needs_play": True},
]


def _p(x: float, d: int = 0) -> str:
    return f"{x * 100:.{d}f}%"


class Assistant:
    def __init__(self, engine: Any) -> None:
        self.e = engine

    # ------------------------------------------------------------ respuestas deterministas
    def quick(self, intent: str, game_id: int | None = None, play_id: int | None = None) -> str:
        fn: dict[str, Callable[[], str]] = {
            "cost": self._cost, "clock": self._clock, "rushers": self._rushers, "blitz": self._blitz,
            "qb_fast": self._qb_fast, "team_ol": self._team_ol,
            "play": lambda: self._play(game_id, play_id),
        }
        if intent not in fn:
            raise KeyError("pregunta rápida desconocida")
        return fn[intent]()

    def _cost(self) -> str:
        k = self.e.summary["kpis"]
        clean, press = self.e.summary["by_pressure"]
        return (f"Con presión el QB pasa de {k['ypa_clean']:.1f} a {k['ypa_pressure']:.1f} yardas por intento "
                f"({k['pressure_cost_ypa']:.1f} yd, IC95 {k['pressure_cost_ci'][0]:.1f} a {k['pressure_cost_ci'][1]:.1f}). "
                f"El % de completos baja de {_p(clean['comp_pct'])} a {_p(press['comp_pct'])} y el éxito de la jugada "
                f"de {_p(clean['success'])} a {_p(press['success'])}. Hay presión en {_p(k['pressure_rate'])} de los dropbacks.")

    def _clock(self) -> str:
        c = self.e.summary.get("cost_by_release") or []
        if not c:
            return "No hay datos de tracking cargados para medir el tiempo hasta lanzar."
        f, n, s = c
        return (f"Sí. Si el QB lanza en menos de 2.5 s, la presión es {_p(f['pressure'])} y cuesta {f['cost']:.1f} yd por intento. "
                f"Entre 2.5 y 3.5 s sube a {_p(n['pressure'])} ({n['cost']:.1f} yd). Si retiene más de 3.5 s llega a "
                f"{_p(s['pressure'])} y cuesta {s['cost']:.1f} yd. Ojo: un QB presionado también tarda más, así que es asociación, no causa pura.")

    def _rushers(self) -> str:
        r = self.e.rushers[self.e.rushers.snaps >= 150].head(5)
        items = []
        for x in r.itertuples():
            extra = f", llega a 2 yd del QB en {_p(x.close_rate)} de sus snaps" if hasattr(x, "close_rate") and pd.notna(x.close_rate) else ""
            items.append(f"{x.displayName} ({x.team}, {x.pos}): presión ajustada {_p(x.eb_rate, 1)} en {x.snaps} snaps{extra}")
        return "Top 5 con 150 snaps o más:\n- " + "\n- ".join(items)

    def _blitz(self) -> str:
        rows = {r["rushers"]: r for r in self.e.summary["by_rushers"]}
        r4, r5, r6 = rows.get(4), rows.get(5), rows.get(6)
        return (f"La presión sube de {_p(r4['pressure'])} con 4 rushers a {_p(r5['pressure'])} con 5, "
                f"pero con 6 se queda en {_p(r6['pressure'])}. El sack es {_p(r4['sack'], 1)} con 4, {_p(r5['sack'], 1)} con 5 "
                f"y {_p(r6['sack'], 1)} con 6. Mandar 5 rinde; mandar 6 casi no agrega presión y deja menos gente en cobertura.")

    def _qb_fast(self) -> str:
        q = self.e.qbs[self.e.qbs.dropbacks >= 100]
        if "ttt_median" not in q:
            return "No hay datos de tracking cargados para medir el tiempo hasta lanzar."
        q = q.sort_values("ttt_median")
        fast = ", ".join(f"{x.qb} {x.ttt_median:.1f} s (presión {_p(x.pressure_rate)})" for x in q.head(3).itertuples())
        slow = ", ".join(f"{x.qb} {x.ttt_median:.1f} s (presión {_p(x.pressure_rate)})" for x in q.tail(3).itertuples())
        return f"Más rápidos: {fast}. Más lentos: {slow}. Los QB que retienen el balón reciben más presión (correlación 0.63)."

    def _team_ol(self) -> str:
        t = self.e.teams.sort_values("pressure_allowed_oe")
        best = ", ".join(f"{x.team} ({_p(x.pressure_allowed)}, {x.pressure_allowed_oe * 100:+.1f} pp)" for x in t.head(3).itertuples())
        worst = ", ".join(f"{x.team} ({_p(x.pressure_allowed)}, {x.pressure_allowed_oe * 100:+.1f} pp)" for x in t.tail(3).iloc[::-1].itertuples())
        return (f"Presión permitida contra la esperada por el modelo. Mejores: {best}. Peores: {worst}. "
                "Parte de esta presión la provoca el QB; revisa la pestaña QB bajo presión.")

    def _play(self, game_id: int | None, play_id: int | None) -> str:
        if not game_id or not play_id:
            return "Abre una jugada en el Simulador y vuelve a preguntar."
        s = self.e.simulate(game_id, play_id, None, "auto", "auto")
        p, r = s["play"], s["real"]
        rush = [x["name"] for x in s["participants"]["rushers"] if x["sack"] or x["hit"] or x["hurry"]]
        beaten = [x["name"] for x in s["participants"]["blockers"] if x["beaten"] or x["allowed"]]
        txt = (f"{p['offense']} contra {p['defense']}, {p['down']}º y {p['yardsToGo']}, cobertura {p['coverage']}. "
               f"Resultado: {r['result_label']} de {r['yards']:.0f} yd, {r['rushers']} rushers, "
               f"{'con' if r['pressure'] else 'sin'} presión")
        if r.get("ttt") is not None:
            txt += f", lanzó a los {r['ttt']:.1f} s"
        if r.get("dist_release") is not None:
            txt += f" con el rusher más cercano a {r['dist_release']:.1f} yd"
        txt += f". En esta situación la liga logra éxito en {_p(s['expected']['success'])} de las jugadas."
        if rush:
            txt += f" Presionaron: {', '.join(rush)}."
        if beaten:
            txt += f" Bloqueadores superados: {', '.join(beaten)}."
        return txt

    # ------------------------------------------------------------ agente con IA
    def _tools(self) -> list[Callable]:
        from strands import tool

        e = self.e

        @tool
        def resumen_liga() -> str:
            """Cifras globales: tasa de presión, costo de la presión, efecto del número de rushers y del tiempo hasta lanzar."""
            s = e.summary
            return json.dumps({"kpis": s["kpis"], "con_y_sin_presion": s["by_pressure"], "por_rushers": s["by_rushers"],
                               "costo_por_tiempo_de_lanzamiento": s.get("cost_by_release"), "coberturas": s["by_coverage"]},
                              ensure_ascii=False)

        @tool
        def ranking_pass_rushers(min_snaps: int = 150, top: int = 10) -> str:
            """Mejores pass rushers por tasa de presión ajustada (Empirical Bayes), con métricas físicas de tracking."""
            d = e.rushers[e.rushers.snaps >= min_snaps].head(top)
            return d.round(3).to_json(orient="records", force_ascii=False)

        @tool
        def ranking_bloqueadores(min_snaps: int = 150, top: int = 10, peores: bool = True) -> str:
            """Bloqueadores con mayor (peores=True) o menor tasa ajustada de veces vencido."""
            d = e.blockers[e.blockers.snaps >= min_snaps]
            d = d.tail(top).iloc[::-1] if peores else d.head(top)
            return d.round(3).to_json(orient="records", force_ascii=False)

        @tool
        def perfil_qb(nombre: str) -> str:
            """Métricas de un quarterback (presión recibida, tiempo hasta lanzar, costo de la presión). Acepta nombre parcial."""
            d = e.qbs[e.qbs.qb.str.contains(nombre, case=False, regex=False)]
            return d.round(3).to_json(orient="records", force_ascii=False) if len(d) else "No encontré ese QB."

        @tool
        def perfil_equipo(equipo: str) -> str:
            """Presión permitida (ofensiva) y generada (defensiva) de un equipo por su abreviatura (ej. KC, TB, DAL)."""
            d = e.teams[e.teams.team == equipo.upper()]
            return d.round(3).to_json(orient="records", force_ascii=False) if len(d) else "No encontré ese equipo."

        @tool
        def jugada_actual(game_id: int, play_id: int) -> str:
            """Contexto, resultado real, participantes y resultado esperado de una jugada."""
            try:
                s = e.simulate(game_id, play_id, None, "auto", "auto")
            except KeyError:
                return "Jugada no encontrada."
            return json.dumps({k: s[k] for k in ("play", "real", "participants", "expected", "release_curve", "curve")},
                              ensure_ascii=False)

        return [resumen_liga, ranking_pass_rushers, ranking_bloqueadores, perfil_qb, perfil_equipo, jugada_actual]

    def ask(self, question: str, game_id: int | None, play_id: int | None) -> dict[str, Any]:
        try:
            from strands import Agent
            from strands.models import BedrockModel

            model = BedrockModel(model_id=os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0"),
                                 region_name=os.environ.get("AWS_REGION", "us-east-1"), temperature=0.2, max_tokens=500)
            ctx = f" El usuario está viendo la jugada gameId={game_id}, playId={play_id}." if game_id and play_id else ""
            agent = Agent(
                model=model, tools=self._tools(), callback_handler=None,
                system_prompt=(
                    "Eres el analista de NFL Pressure Lab. Respondes en español, en máximo 5 oraciones, a coaches, analistas y fans. "
                    "Usa SIEMPRE las herramientas para obtener cifras; nunca inventes datos. Los datos son de la temporada 2021, "
                    "semanas 1 a 8 (PFF y tracking). Las tasas vienen como proporción: muéstralas como porcentaje. "
                    "Si algo no está en los datos, dilo." + ctx),
            )
            return {"available": True, "text": str(agent(question)).strip()}
        except Exception as exc:  # la IA es opcional
            logger.info("Asistente IA no disponible: %s", type(exc).__name__)
            return {"available": False, "text": None}
