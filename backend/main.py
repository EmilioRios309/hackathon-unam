from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

from backend.ingestion import DataIngestionLayer
from backend.simulator import CounterfactualSimulator

app = FastAPI(
    title="Simulador Contrafactual NFL",
    version="1.0.0",
    description="Backend API de Simulación de decisiones tácticas NFL para entrenadores"
)

# Inicializar capa de ingesta y simulador en memoria
ingestion = DataIngestionLayer(data_path="data/nfl_sample.csv")
try:
    df_plays = ingestion.load_and_normalize()
except Exception as e:
    df_plays = None

simulator = CounterfactualSimulator()

# Modelos Pydantic de solicitud
class OffensiveSimRequest(BaseModel):
    play_id: int
    sim_play_type: str = Field(..., example="pass")
    sim_target_gap: str = Field(..., example="checkdown")
    aggressiveness: Optional[float] = 1.0

class DefensiveSimRequest(BaseModel):
    play_id: int
    sim_coverage: str = Field(..., example="cover_4")
    sim_blitz_count: int = Field(..., example=3)

# Contrato obligatorio del Hackathon
@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/plays")
def list_plays():
    if df_plays is None:
        raise HTTPException(status_code=500, detail="Dataset no cargado")
    return df_plays.to_dict(orient="records")

@app.post("/api/simulate/offensive")
def simulate_offensive(req: OffensiveSimRequest):
    if df_plays is None:
        raise HTTPException(status_code=500, detail="Dataset no cargado")
    
    match = df_plays[df_plays["play_id"] == req.play_id]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Jugada {req.play_id} no encontrada")
    
    play_row = match.iloc[0]
    result = simulator.simulate_offensive_scenario(
        play_row, req.sim_play_type, req.sim_target_gap, req.aggressiveness or 1.0
    )
    return result

@app.post("/api/simulate/defensive")
def simulate_defensive(req: DefensiveSimRequest):
    if df_plays is None:
        raise HTTPException(status_code=500, detail="Dataset no cargado")
    
    match = df_plays[df_plays["play_id"] == req.play_id]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Jugada {req.play_id} no encontrada")
    
    play_row = match.iloc[0]
    result = simulator.simulate_defensive_scenario(
        play_row, req.sim_coverage, req.sim_blitz_count
    )
    return result

@app.get("/api/game-summary")
def get_game_summary():
    if df_plays is None:
        raise HTTPException(status_code=500, detail="Dataset no cargado")
    
    key_moments = df_plays[(df_plays["down"] >= 3) | (df_plays["actual_epa"].abs() >= 1.0)]
    return {
        "total_plays_analyzed": len(df_plays),
        "key_counterfactual_moments_count": len(key_moments),
        "key_moments": key_moments.to_dict(orient="records")
    }