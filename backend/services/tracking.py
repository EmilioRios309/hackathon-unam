"""Tracking (10 cuadros por segundo) de data/tracking/tracking_<gameId>.csv.

- Al arrancar: se procesa juego por juego y solo se guardan agregados por jugada y por rusher.
- Bajo demanda: cuadros de una jugada para el campo 2D (con caché en memoria de unos pocos juegos).
Coordenadas normalizadas: la ofensiva siempre avanza hacia x creciente (zona de anotación en x = 110).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

TRACK_DIR = Path(__file__).resolve().parents[2] / "data" / "tracking"
SNAP_EVENTS = {"ball_snap", "autoevent_ballsnap"}
END_EVENTS = {"pass_forward", "autoevent_passforward", "qb_sack", "qb_strip_sack", "run", "lateral"}
END_LABELS = {"pass_forward": "Lanzamiento", "autoevent_passforward": "Lanzamiento", "qb_sack": "Sack",
              "qb_strip_sack": "Sack con balón suelto", "run": "QB corre", "lateral": "Lateral", "fin": "Fin de jugada"}
EVENT_LABELS = {"ball_snap": "Snap", "autoevent_ballsnap": "Snap", "play_action": "Play action",
                "pass_forward": "Lanzamiento", "autoevent_passforward": "Lanzamiento", "qb_sack": "Sack",
                "qb_strip_sack": "Sack (fumble)", "run": "QB corre", "pass_arrived": "Llega el balón",
                "pass_outcome_caught": "Atrapado", "pass_outcome_incomplete": "Incompleto",
                "pass_outcome_interception": "Intercepción", "fumble": "Fumble", "man_in_motion": "Motion",
                "line_set": "Línea fija", "shift": "Shift"}
SUM_COLS = ["gameId", "playId", "nflId", "frameId", "team", "playDirection", "x", "y", "s", "event"]
FRAME_COLS = SUM_COLS + ["jerseyNumber"]
CLOSE_YD = 2.0  # radio de "llegada" al QB
PRE_SNAP_FRAMES = 10  # 1 s antes del snap
POST_END_FRAMES = 15  # 1.5 s después del lanzamiento o sack


def available() -> bool:
    return TRACK_DIR.exists() and any(TRACK_DIR.glob("tracking_*.csv"))


def _path(game_id: int) -> Path:
    return TRACK_DIR / f"tracking_{game_id}.csv"


def _normalize(d: pd.DataFrame) -> pd.DataFrame:
    left = (d.playDirection == "left").to_numpy()
    d["x"] = np.where(left, 120 - d.x, d.x)
    d["y"] = np.where(left, 53.3 - d.y, d.y)
    return d


def _frame_marks(d: pd.DataFrame) -> pd.DataFrame:
    """Por jugada: cuadro del snap, del fin del dropback (lanzamiento, sack o carrera) y último cuadro."""
    ev = d.loc[d.event.notna(), ["playId", "frameId", "event"]].drop_duplicates()
    snap = ev[ev.event.isin(SNAP_EVENTS)].groupby("playId").frameId.min().rename("snap")
    e = ev[ev.event.isin(END_EVENTS)].merge(snap.reset_index(), on="playId")
    e = e[e.frameId >= e.snap].sort_values("frameId").drop_duplicates("playId")
    end = e.set_index("playId")[["frameId", "event"]].rename(columns={"frameId": "end", "event": "end_event"})
    last = d.groupby("playId").frameId.max().rename("last")
    fr = pd.concat([snap, end, last], axis=1)
    fr.index.name = "playId"
    fr = fr.dropna(subset=["snap"])
    fr["end_event"] = fr.end_event.fillna("fin")
    fr["end"] = fr.end.fillna(fr["last"])
    return fr.astype({"snap": int, "end": int, "last": int})


def _summarize_game(path: Path, roles: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    d = _normalize(pd.read_csv(path, usecols=SUM_COLS))
    gid = int(d.gameId.iat[0])
    fr = _frame_marks(d)
    d = d.merge(fr[["snap", "end"]], left_on="playId", right_index=True)
    d = d.merge(roles, on=["playId", "nflId"], how="left")
    qb = (d[d.pff_role == "Pass"].drop_duplicates(["playId", "frameId"])
          [["playId", "frameId", "x", "y"]].rename(columns={"x": "qx", "y": "qy"}))
    rush = d[(d.pff_role == "Pass Rush") & (d.frameId >= d.snap) & (d.frameId <= d.end)].merge(qb, on=["playId", "frameId"])
    rush["dist"] = np.hypot(rush.x - rush.qx, rush.y - rush.qy)
    rush["t"] = (rush.frameId - rush.snap) / 10

    key = ["playId", "nflId"]
    close = rush[rush.dist <= CLOSE_YD].groupby(key).t.min().rename("t_close")
    getoff = rush[rush.t <= 1.0].groupby(key).s.max().rename("speed_1s")
    per_rusher = rush.groupby(key).dist.min().rename("min_dist").to_frame().join(close).join(getoff).reset_index()
    per_rusher["gameId"] = gid

    pl = (fr.join(rush[rush.frameId == rush.end].groupby("playId").dist.min().rename("dist_release"))
            .join(rush.groupby("playId").dist.min().rename("min_dist"))
            .join(close.groupby("playId").min().rename("t_first_close")))
    pl["ttt"] = (pl.end - pl.snap) / 10
    pl = pl.reset_index()
    pl["gameId"] = gid
    return pl[["gameId", "playId", "ttt", "end_event", "dist_release", "min_dist", "t_first_close"]], per_rusher


def summarize_all(pff: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    roles = pff[["gameId", "playId", "nflId", "pff_role"]]
    by_game = {g: r.drop(columns="gameId") for g, r in roles.groupby("gameId")}
    plays, rushers = [], []
    for path in sorted(TRACK_DIR.glob("tracking_*.csv")):
        gid = int(path.stem.split("_")[1])
        if gid not in by_game:
            continue
        p, r = _summarize_game(path, by_game[gid])
        plays.append(p)
        rushers.append(r)
    if not plays:
        return pd.DataFrame(), pd.DataFrame()
    return pd.concat(plays, ignore_index=True), pd.concat(rushers, ignore_index=True)


@lru_cache(maxsize=6)
def _game_frames(game_id: int) -> pd.DataFrame:
    return _normalize(pd.read_csv(_path(game_id), usecols=FRAME_COLS))


def _r(v: float, nd: int = 2) -> float:
    return round(float(v), nd)


def play_frames(game_id: int, play_id: int, pff_play: pd.DataFrame, play: dict[str, Any]) -> dict[str, Any]:
    """Cuadros de una jugada para la vista 2D. pff_play: filas de pffScoutingData de esa jugada con nombre y posición."""
    if not _path(game_id).exists():
        raise KeyError("no hay tracking para este juego")
    g = _game_frames(game_id)
    d = g[g.playId == play_id]
    if d.empty:
        raise KeyError("no hay tracking para esta jugada")
    fr = _frame_marks(d)
    if fr.empty:
        raise KeyError("la jugada no tiene evento de snap")
    m = fr.iloc[0]
    snap, end, last = int(m.snap), int(m.end), int(m["last"])
    start, stop = max(snap - PRE_SNAP_FRAMES, int(d.frameId.min())), min(end + POST_END_FRAMES, last)
    d = d[(d.frameId >= start) & (d.frameId <= stop)]

    ball = d[d.team == "football"].set_index("frameId")[["x", "y"]]
    los = float(ball.x.get(snap, ball.x.iloc[0]))

    info = pff_play.set_index("nflId")
    order = {"Pass": 0, "Pass Block": 1, "Pass Route": 2, "Pass Rush": 3, "Coverage": 4}
    ids = [int(i) for i in d.nflId.dropna().unique()]
    ids.sort(key=lambda i: (order.get(info.pff_role.get(i), 9), i))
    idx = {pid: k for k, pid in enumerate(ids)}
    jersey = d.dropna(subset=["nflId"]).drop_duplicates("nflId").set_index("nflId").jerseyNumber

    players = []
    for pid in ids:
        r = info.loc[pid] if pid in info.index else None
        role = r.pff_role if r is not None else "Otro"
        blocked = r.pff_nflIdBlockedPlayer if r is not None else np.nan
        players.append({
            "i": idx[pid], "nflId": pid, "name": r.displayName if r is not None else str(pid),
            "pos": r.pos if r is not None else "", "aligned": r.pff_positionLinedUp if r is not None else "",
            "jersey": int(jersey.get(pid)) if pd.notna(jersey.get(pid)) else None,
            "role": role, "side": "off" if role in ("Pass", "Pass Block", "Pass Route") else "def",
            "hit": bool(r is not None and r.pff_hit == 1), "hurry": bool(r is not None and r.pff_hurry == 1),
            "sack": bool(r is not None and r.pff_sack == 1), "beaten": bool(r is not None and r.pff_beatenByDefender == 1),
            "blocked": idx.get(int(blocked)) if pd.notna(blocked) else None,
            "block_type": r.pff_blockType if r is not None and isinstance(r.pff_blockType, str) else None,
        })

    qb_i = next((p["i"] for p in players if p["role"] == "Pass"), None)
    rush_i = [p["i"] for p in players if p["role"] == "Pass Rush"]
    frames, qb_dist = [], []
    pp = d.dropna(subset=["nflId"])
    for f, grp in pp.groupby("frameId", sort=True):
        pos: list[Any] = [None] * len(ids)
        for row in grp.itertuples(index=False):
            pos[idx[int(row.nflId)]] = [_r(row.x), _r(row.y), _r(row.s, 1)]
        b = ball.loc[f] if f in ball.index else None
        t = (f - snap) / 10
        frames.append({"f": int(f), "t": round(t, 1), "ball": [_r(b.x), _r(b.y)] if b is not None else None, "p": pos})
        if qb_i is not None and pos[qb_i] and snap <= f <= end and rush_i:
            qx, qy = pos[qb_i][0], pos[qb_i][1]
            ds = [(np.hypot(pos[k][0] - qx, pos[k][1] - qy), k) for k in rush_i if pos[k]]
            if ds:
                dmin, k = min(ds)
                qb_dist.append({"t": round(t, 1), "d": _r(dmin), "who": k})

    ev = d.loc[d.event.notna(), ["frameId", "event"]].drop_duplicates()
    events = [{"t": round((int(r.frameId) - snap) / 10, 1), "label": EVENT_LABELS.get(r.event, r.event)}
              for r in ev.itertuples() if r.event in EVENT_LABELS]

    ytg = int(play.get("yardsToGo") or 0)
    return {
        "gameId": game_id, "playId": play_id, "los": _r(los), "first_down": _r(min(los + ytg, 110)),
        "snap_t": 0.0, "end_t": round((end - snap) / 10, 1), "end_label": END_LABELS.get(m.end_event, "Fin de jugada"),
        "qb": qb_i, "players": players, "frames": frames, "qb_dist": qb_dist, "events": events,
        "close_yd": CLOSE_YD,
    }
