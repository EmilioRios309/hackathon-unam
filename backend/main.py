import os
from pathlib import Path


def cargar_env():
    f = Path(__file__).resolve().parent.parent / ".env"
    if f.exists():
        for linea in f.read_text(encoding="utf-8-sig").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


cargar_env()

import logging  # noqa: E402
import sys  # noqa: E402
from typing import Literal, Optional  # noqa: E402

from fastapi import FastAPI, HTTPException, Query  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from services import ai_advisor  # noqa: E402
from services.analytics import PressureAnalytics, records  # noqa: E402
from services.assistant import SUGGESTIONS, Assistant  # noqa: E402

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="NFL Pressure Lab API", version="2.0.0",
              description="Presión: quién la genera, quién la permite y cuánto cuesta (NFL Big Data Bowl 2023, semanas 1-8)")

engine = PressureAnalytics()
assistant = Assistant(engine)


class SimRequest(BaseModel):
    gameId: int
    playId: int
    rushers: Optional[int] = Field(default=None, ge=3, le=7)
    pressure: Literal["auto", "yes", "no"] = "auto"
    release: Literal["auto", "rapido", "normal", "largo"] = "auto"


class ExplainRequest(SimRequest):
    perspective: Literal["offense", "defense"] = "offense"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/summary")
def summary():
    return engine.summary


@app.get("/api/rushers")
def rushers(min_snaps: int = Query(100, ge=1), limit: int = Query(25, ge=1, le=500)):
    d = engine.rushers[engine.rushers.snaps >= min_snaps].head(limit)
    return {"prior": engine.rush_prior, "players": records(d)}


@app.get("/api/blockers")
def blockers(min_snaps: int = Query(100, ge=1), limit: int = Query(15, ge=1, le=500)):
    d = engine.blockers[engine.blockers.snaps >= min_snaps]
    return {"prior": engine.block_prior, "best": records(d.head(limit)),
            "worst": records(d.tail(limit).iloc[::-1]), "by_position": engine.blockers_by_pos}


@app.get("/api/qbs")
def qbs(min_dropbacks: int = Query(100, ge=1)):
    return records(engine.qbs[engine.qbs.dropbacks >= min_dropbacks])


@app.get("/api/teams")
def teams():
    return records(engine.teams)


@app.get("/api/plays")
def plays(team: Optional[str] = None, week: Optional[int] = None, pressure: Optional[str] = None,
          down: Optional[int] = None, q: Optional[str] = None, limit: int = Query(60, ge=1, le=300)):
    return engine.list_plays(team, week, pressure, down, q, limit)


@app.get("/api/play-frames")
def play_frames(gameId: int, playId: int):
    try:
        return engine.frames(gameId, playId)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/simulate")
def simulate(req: SimRequest):
    try:
        return engine.simulate(req.gameId, req.playId, req.rushers, req.pressure, req.release)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/explain")
def explain(req: ExplainRequest):
    try:
        sim = engine.simulate(req.gameId, req.playId, req.rushers, req.pressure, req.release)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return ai_advisor.explain(sim, req.perspective)


class AssistantRequest(BaseModel):
    question: Optional[str] = Field(default=None, max_length=500)
    intent: Optional[str] = Field(default=None, max_length=30)
    gameId: Optional[int] = None
    playId: Optional[int] = None


@app.get("/api/assistant/suggestions")
def assistant_suggestions():
    return SUGGESTIONS


@app.post("/api/assistant")
def ask_assistant(req: AssistantRequest):
    if req.intent:
        try:
            return {"available": True, "source": "datos", "text": assistant.quick(req.intent, req.gameId, req.playId)}
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=422, detail="escribe una pregunta")
    out = assistant.ask(req.question.strip(), req.gameId, req.playId)
    return {**out, "source": "ia"}


# Build del dashboard en la misma URL (montado al final para no tapar /api ni /health)
_dist = BASE_DIR.parent / "dashboard" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="dashboard")
