import json
import os
from typing import Dict, Any

class TacticalAIAdvisor:
    """Asesor Táctico con Amazon Bedrock (Nova) y Fallback Resiliente en memoria."""

    def __init__(self):
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")
        self.model_id = os.getenv("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")

    def generate_tactical_summary(self, play_info: Dict[str, Any], sim_result: Dict[str, Any]) -> str:
        """Genera un diagnóstico ejecutivo para el Head Coach usando Bedrock o Fallback local."""
        deltas = sim_result.get("deltas", {})
        is_defensive = "epa_prevented" in deltas or "yards_prevented" in deltas

        try:
            import boto3
            client = boto3.client("bedrock-runtime", region_name=self.aws_region)

            if is_defensive:
                epa_val = deltas.get("epa_prevented", 0.0)
                yds_val = deltas.get("yards_prevented", 0.0)
                prompt = (
                    f"Eres el Coordinador Defensivo de la NFL. Analiza la jugada ID {play_info.get('play_id')}:\n"
                    f"Situación: Down {play_info.get('down')}, {play_info.get('ydstogo')} yds por avanzar.\n"
                    f"Resultado Real: {play_info.get('play_description')} (EPA Permitido: {play_info.get('actual_epa')}).\n"
                    f"Simulación Defensiva: {sim_result.get('tactical_narrative')} (EPA Prevenido: {epa_val}, Yardas Prevenidas: {yds_val}).\n"
                    f"Redacta un diagnóstico ejecutivo conciso para el Head Coach destacando el ajuste defensivo en máximo 2 oraciones."
                )
            else:
                epa_val = deltas.get("delta_epa", 0.0)
                yds_val = deltas.get("delta_yards", 0.0)
                prompt = (
                    f"Eres el Coordinador Ofensivo de la NFL. Analiza la jugada ID {play_info.get('play_id')}:\n"
                    f"Situación: Down {play_info.get('down')}, {play_info.get('ydstogo')} yds por avanzar.\n"
                    f"Resultado Real: {play_info.get('play_description')} (EPA Real: {play_info.get('actual_epa')}).\n"
                    f"Simulación Contrafactual: {sim_result.get('tactical_narrative')} (Delta EPA: {epa_val}, Delta Yardas: {yds_val}).\n"
                    f"Redacta un diagnóstico ejecutivo conciso para el Head Coach destacando el beneficio táctico en máximo 2 oraciones."
                )

            body = json.dumps({
                "inferenceConfig": {"max_new_tokens": 120, "temperature": 0.3},
                "messages": [{"role": "user", "content": [{"text": prompt}]}]
            })

            response = client.invoke_model(modelId=self.model_id, body=body)
            response_body = json.loads(response["body"].read())
            return response_body["output"]["message"]["content"]["text"]

        except Exception:
            # Fallback determinista en memoria (Resiliencia total sin conexión AWS)
            if is_defensive:
                epa_prevented = deltas.get("epa_prevented", 0.0)
                yards_prevented = deltas.get("yards_prevented", 0.0)
                if epa_prevented >= 0:
                    return (
                        f"[Diagnóstico IA] El ajuste defensivo previene +{epa_prevented:.2f} pts de EPA "
                        f"y reduce {yards_prevented:+.1f} yardas permitidas frente al esquema ejecutado."
                    )
                else:
                    return (
                        f"[Diagnóstico IA] El ajuste defensivo muestra una variación de {epa_prevented:.2f} pts de EPA "
                        f"({yards_prevented:+.1f} yds permitidas). Se sugiere evaluar el riesgo de cobertura."
                    )
            else:
                delta_epa = deltas.get("delta_epa", 0.0)
                delta_yds = deltas.get("delta_yards", 0.0)
                if delta_epa >= 0:
                    return (
                        f"[Diagnóstico IA] El ajuste propuesto optimiza la eficiencia táctica en +{delta_epa:.2f} pts de EPA y "
                        f"proyecta una mejora de {delta_yds:+.1f} yardas frente al esquema ejecutado."
                    )
                else:
                    return (
                        f"[Diagnóstico IA] El esquema simulado presenta un diferencial de EPA de {delta_epa:.2f} pts. "
                        f"Se sugiere priorizar la lectura de riesgo según la presión defensiva."
                    )