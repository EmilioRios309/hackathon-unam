"""Narrativa opcional con Amazon Bedrock (Nova). Si falla, la app sigue funcionando sin ella."""
import logging
import os
from typing import Any

logger = logging.getLogger("nfl.ai_advisor")


def _pct(x: float) -> str:
    return f"{x * 100:.0f}%"


def build_prompt(sim: dict[str, Any], perspective: str) -> str:
    p, r, e, s = sim["play"], sim["real"], sim["expected"], sim["simulated"]
    sc = sim["scenario"]
    mode = {"yes": "presión forzada", "no": "sin presión (bolsa limpia)"}.get(sc["pressure_mode"], f"{sc['rushers']} rushers")
    release = {"rapido": "lanzamiento rápido (<2.5 s)", "normal": "lanzamiento normal (2.5-3.5 s)",
               "largo": "QB retiene el balón (>3.5 s)"}.get(sc.get("release", "auto"))
    if release:
        mode += f", {release}"
    ttt = r.get("ttt")
    role = "coordinador ofensivo" if perspective == "offense" else "coordinador defensivo"
    return (
        f"Eres un {role} de la NFL. Responde en español, máximo 3 oraciones, sin inventar datos.\n"
        f"Jugada: {p['offense']} vs {p['defense']}, {p['down']}º y {p['yardsToGo']}, cobertura {p['coverage']}. "
        f"Descripción: {p['description']}\n"
        f"Real: {r['result_label']}, {r['yards']:.0f} yardas, presión={'sí' if r['pressure'] else 'no'}, {r['rushers']} rushers"
        f"{f', lanzó a los {ttt:.1f} s' if ttt else ''}.\n"
        f"Esperado por el modelo con lo que se envió: {e['yards']:.1f} yardas, éxito {_pct(e['success'])}, sack {_pct(e['sack'])}.\n"
        f"Escenario simulado ({mode}, P(presión)={_pct(sc['p_pressure'])}): {s['yards']:.1f} yardas, "
        f"éxito {_pct(s['success'])}, sack {_pct(s['sack'])}, intercepción {_pct(s['int'])}.\n"
        f"Explica qué cambia con el escenario y qué recomendarías desde tu lado del balón."
    )


def explain(sim: dict[str, Any], perspective: str) -> dict[str, Any]:
    region = os.environ.get("AWS_REGION", "us-east-1")
    model_id = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0")
    try:
        import boto3

        client = boto3.client("bedrock-runtime", region_name=region)
        resp = client.converse(
            modelId=model_id,
            messages=[{"role": "user", "content": [{"text": build_prompt(sim, perspective)}]}],
            inferenceConfig={"maxTokens": 250, "temperature": 0.3},
        )
        text = resp["output"]["message"]["content"][0]["text"]
        return {"available": True, "text": text}
    except Exception as exc:  # la IA es opcional
        logger.info("IA no disponible: %s", type(exc).__name__)
        return {"available": False, "text": None}
