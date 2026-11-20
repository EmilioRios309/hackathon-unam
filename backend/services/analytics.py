"""Métricas de presión, modelos de probabilidad de presión y simulador contrafactual.

Todo se calcula en memoria al arrancar a partir de data/ (solo lectura).
Población: dropbacks regulares (sin conversiones de 2 puntos), sin falta y con registro de rushers.
"""
from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from . import tracking

logger = logging.getLogger("nfl.analytics")

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"

KEY = ["gameId", "playId"]
DIST_BINS = [-1, 3, 6, 10, 99]
DIST_LABELS = ["1-3", "4-6", "7-10", "11+"]
RUSH_LEVELS = [3, 4, 5, 6, 7]
COV_TYPES = ["Man", "Zone", "Other"]
RELEASE = ["rapido", "normal", "largo"]  # tiempo hasta lanzar: <2.5 s, 2.5-3.5 s, >3.5 s
RELEASE_LABELS = {"rapido": "Rápido (<2.5 s)", "normal": "Normal (2.5-3.5 s)", "largo": "Largo (>3.5 s)"}
RELEASE_BINS = [0, 2.5, 3.5, 99]
TTT_FINE_BINS = [0, 2, 2.5, 3, 3.5, 4, 5, 99]
TTT_FINE_LABELS = ["<2", "2-2.5", "2.5-3", "3-3.5", "3.5-4", "4-5", "5+"]
K_CELL = 30.0  # pseudo-jugadas para encoger celdas pequeñas hacia su nivel superior
RESULT_LABELS = {"C": "Completo", "I": "Incompleto", "S": "Sack", "R": "Scramble", "IN": "Intercepción"}
OUTCOME_KEYS = ["comp", "inc", "int", "sack", "scr", "success", "yards"]
LEVELS_BASE = [["pressure"], ["pressure", "down_g", "dist_b"], ["pressure", "down_g", "dist_b", "cov_type"]]
LEVELS_TTT = [["pressure"], ["pressure", "ttt_b"], ["pressure", "ttt_b", "down_g", "dist_b"],
              ["pressure", "ttt_b", "down_g", "dist_b", "cov_type"]]


# ---------------------------------------------------------------- utilidades
def _clean(v: Any) -> Any:
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else round(f, 4)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if v is pd.NA or v is pd.NaT:
        return None
    return v


def _deep_clean(o: Any) -> Any:
    if isinstance(o, dict):
        return {k: _deep_clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_deep_clean(v) for v in o]
    return _clean(o)


def records(df: pd.DataFrame) -> list[dict[str, Any]]:
    return [{k: _clean(v) for k, v in r.items()} for r in df.to_dict(orient="records")]


def _py(v: Any) -> Any:
    return v.item() if hasattr(v, "item") else v


def _sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


def auc(y: np.ndarray, s: np.ndarray) -> float:
    r = pd.Series(s).rank().to_numpy()
    n1 = y.sum()
    n0 = len(y) - n1
    return float((r[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def bootstrap_diff(a: np.ndarray, b: np.ndarray, reps: int = 1000, seed: int = 7) -> tuple[float, float]:
    """IC95 de mean(a) - mean(b) por bootstrap percentil."""
    if len(a) < 5 or len(b) < 5:
        return (float("nan"), float("nan"))
    rng = np.random.default_rng(seed)
    da = rng.choice(a, (reps, len(a))).mean(axis=1)
    db = rng.choice(b, (reps, len(b))).mean(axis=1)
    lo, hi = np.percentile(da - db, [2.5, 97.5])
    return float(lo), float(hi)


def eb_prior_strength(events: pd.Series, trials: pd.Series, min_trials: int = 30) -> tuple[float, float]:
    """Empirical Bayes beta-binomial por momentos. Devuelve (media global, k)."""
    mu = events.sum() / trials.sum()
    m = trials >= min_trials
    rate = events[m] / trials[m]
    tau2 = max(rate.var() - (mu * (1 - mu) / trials[m]).mean(), 1e-6)
    return float(mu), float(max(mu * (1 - mu) / tau2 - 1, 1.0))


# ---------------------------------------------------------------- modelo logístico
class LogitModel:
    """Regresión logística con L2 resuelta por Newton-Raphson, solo numpy."""

    def __init__(self, num: list[str], cat: dict[str, list[Any]], lam: float = 1.0):
        self.num, self.cat, self.lam = num, cat, lam
        self.mu: pd.Series | None = None
        self.sd: pd.Series | None = None
        self.w: np.ndarray | None = None
        self.names: list[str] = []

    def design(self, df: pd.DataFrame) -> np.ndarray:
        cols = [((df[c].astype(float) - self.mu[c]) / self.sd[c]).to_numpy() for c in self.num]
        names = list(self.num)
        for c, levels in self.cat.items():
            for lv in levels[1:]:  # el primer nivel es la referencia
                cols.append((df[c] == lv).astype(float).to_numpy())
                names.append(f"{c}={lv}")
        self.names = names
        return np.column_stack([np.ones(len(df))] + cols)

    def fit(self, df: pd.DataFrame, y: np.ndarray) -> "LogitModel":
        self.mu = df[self.num].astype(float).mean()
        self.sd = df[self.num].astype(float).std().replace(0, 1)
        X = self.design(df)
        w = np.zeros(X.shape[1])
        pen = np.full(X.shape[1], self.lam)
        pen[0] = 0.0
        for _ in range(30):
            p = _sigmoid(X @ w)
            H = X.T @ (X * (p * (1 - p))[:, None]) + np.diag(pen)
            step = np.linalg.solve(H, X.T @ (y - p) - pen * w)
            w += step
            if np.abs(step).max() < 1e-7:
                break
        self.w = w
        return self

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        return _sigmoid(self.design(df) @ self.w)

    def coefficients(self) -> list[dict[str, Any]]:
        out = [{"feature": n, "coef": round(float(c), 4)} for n, c in zip(self.names, self.w[1:])]
        return sorted(out, key=lambda d: -abs(d["coef"]))


def _validate(df: pd.DataFrame, y: np.ndarray, num: list[str], cat: dict[str, list[Any]]) -> dict[str, float]:
    """Validación separando por juego: 25% de los juegos como prueba."""
    games = np.sort(df.gameId.unique())
    rng = np.random.default_rng(1)
    rng.shuffle(games)
    te = df.gameId.isin(set(games[: int(len(games) * 0.25)])).to_numpy()
    p = LogitModel(num, cat).fit(df[~te], y[~te]).predict(df[te])
    return {"auc": round(auc(y[te], p), 4), "brier": round(float(((p - y[te]) ** 2).mean()), 4),
            "brier_baseline": round(float(((y[~te].mean() - y[te]) ** 2).mean()), 4),
            "n_train": int((~te).sum()), "n_test": int(te.sum()), "games_test": int(len(set(df.gameId[te])))}


# ---------------------------------------------------------------- motor
class PressureAnalytics:
    NUM = ["yardsToGo", "yards_to_goal", "score_diff", "sec_left", "defendersInBox_f"]
    CAT = {"down": [1, 2, 3, 4], "formation": ["SHOTGUN", "EMPTY", "SINGLEBACK", "I_FORM", "PISTOL", "OTHER"],
           "cov_type": ["Zone", "Man", "Other"]}

    def __init__(self) -> None:
        self._load()
        self._build_play_table()
        self._fit_models()
        self.tables = self._hier_tables(self.c, LEVELS_BASE)
        self.tables_ttt = self._hier_tables(self.c.dropna(subset=["ttt_b"]), LEVELS_TTT) if self.has_tracking else []
        self._build_metrics()

    # ---------- carga y limpieza (no modifica data/)
    def _load(self) -> None:
        self.games = pd.read_csv(DATA / "games.csv")
        self.plays_raw = pd.read_csv(DATA / "plays.csv")
        players = pd.read_csv(DATA / "players.csv")
        players["pos"] = players.officialPosition.replace({"DB": "CB", "LB": "OLB"})  # 4 genéricos
        self.players = players
        pff = pd.read_csv(DATA / "pffScoutingData.csv")
        self.pff = pff.merge(players[["nflId", "displayName", "pos"]], on="nflId", how="left")
        self.has_tracking = tracking.available()
        if self.has_tracking:
            self.trk_plays, self.trk_rush = tracking.summarize_all(self.pff)
            self.has_tracking = not self.trk_plays.empty
            logger.info("tracking: %s jugadas", len(self.trk_plays))
        if not self.has_tracking:
            self.trk_plays = pd.DataFrame(columns=KEY + ["ttt", "end_event", "dist_release", "min_dist", "t_first_close"])
            self.trk_rush = pd.DataFrame(columns=KEY + ["nflId", "min_dist", "t_close", "speed_1s"])

    def _build_play_table(self) -> None:
        p = self.plays_raw.merge(self.games[["gameId", "week", "homeTeamAbbr"]], on="gameId", how="left")
        f = self.pff
        rush = f[f.pff_role == "Pass Rush"].copy()
        rush["pres"] = (rush[["pff_hit", "pff_hurry", "pff_sack"]].fillna(0).sum(axis=1) > 0).astype(int)
        self.rush = rush
        p = p.merge(rush.groupby(KEY).agg(n_rush=("nflId", "size"), n_pres=("pres", "sum")).reset_index(), on=KEY, how="left")
        qb = (f[f.pff_role == "Pass"].sort_values("nflId").drop_duplicates(KEY)
              [KEY + ["nflId", "displayName"]].rename(columns={"nflId": "qbId", "displayName": "qb"}))
        p = p.merge(qb, on=KEY, how="left")
        p = p.merge(self.trk_plays, on=KEY, how="left")

        p["has_foul"] = p.foulName1.notna() | p.penaltyYards.notna()
        p["is_sack"] = p.passResult.eq("S")
        p["is_scr"] = p.passResult.eq("R")
        p["is_int"] = p.passResult.eq("IN")
        p["is_comp"] = p.passResult.eq("C")
        p["is_inc"] = p.passResult.eq("I")
        p["is_att"] = p.passResult.isin(["C", "I", "IN"])
        p["pressure"] = (p.n_pres.fillna(0) > 0) | p.is_sack
        p["yards"] = p.prePenaltyPlayResult.astype(float)
        need = np.select([p.down == 1, p.down == 2], [0.4 * p.yardsToGo, 0.6 * p.yardsToGo], p.yardsToGo)
        p["success"] = p.yards >= need
        p["down_g"] = p.down.clip(upper=3)
        p["dist_b"] = pd.cut(p.yardsToGo, DIST_BINS, labels=DIST_LABELS).astype(str)
        p["cov_type"] = p.pff_passCoverageType.where(p.pff_passCoverageType.isin(COV_TYPES), "Other")
        p["yards_to_goal"] = np.where(p.yardlineSide.isna(), 50,
                                      np.where(p.yardlineSide == p.possessionTeam, 100 - p.yardlineNumber, p.yardlineNumber))
        home = p.possessionTeam == p.homeTeamAbbr
        p["score_diff"] = np.where(home, p.preSnapHomeScore - p.preSnapVisitorScore, p.preSnapVisitorScore - p.preSnapHomeScore)
        clk = p.gameClock.str.split(":", expand=True).astype(int)
        p["sec_left"] = np.where(p.quarter <= 4, (4 - p.quarter) * 900 + clk[0] * 60 + clk[1], clk[0] * 60 + clk[1])
        p["defendersInBox_f"] = p.defendersInBox.fillna(p.defendersInBox.median())
        p["formation"] = p.offenseFormation.fillna("OTHER")
        p.loc[~p.formation.isin(self.CAT["formation"]), "formation"] = "OTHER"
        p["n_rush_c"] = p.n_rush.clip(RUSH_LEVELS[0], RUSH_LEVELS[-1])
        p["ttt"] = pd.to_numeric(p.ttt, errors="coerce")
        p["ttt_b"] = pd.cut(p.ttt, RELEASE_BINS, labels=RELEASE, right=False).astype(object)
        p["ttt_fine"] = pd.cut(p.ttt, TTT_FINE_BINS, labels=TTT_FINE_LABELS, right=False).astype(object)

        c = p[(p.down > 0) & (~p.has_foul) & p.n_rush.notna()].copy()
        c["n_rush_c"] = c.n_rush_c.astype(int)
        self.all_plays = p
        self.c = c.reset_index(drop=True)

    # ---------- Modelo A: P(presión | contexto pre-snap + rushers). Modelo B: + tiempo hasta lanzar.
    def _fit_models(self) -> None:
        c = self.c
        y = c.pressure.astype(int).to_numpy()
        cat_a = {**self.CAT, "n_rush_c": RUSH_LEVELS}
        self.model_eval = {"target": "presión (hit, hurry o sack de algún rusher)", "positive_rate": round(float(y.mean()), 4),
                           **_validate(c, y, self.NUM, cat_a),
                           "auc_without_rushers": _validate(c, y, self.NUM, self.CAT)["auc"]}
        self.model = LogitModel(self.NUM, cat_a).fit(c, y)
        self.c["p_pressure"] = self.model.predict(self.c)
        self.model_eval["coefficients"] = self.model.coefficients()[:12]

        self.model_b = None
        if self.has_tracking:
            cb = c.dropna(subset=["ttt_b"]).reset_index(drop=True)
            yb = cb.pressure.astype(int).to_numpy()
            cat_b = {**cat_a, "ttt_b": RELEASE}
            self.model_eval["release_model"] = _validate(cb, yb, self.NUM, cat_b)
            self.model_b = LogitModel(self.NUM, cat_b).fit(cb, yb)
            ok = c.min_dist.notna()
            self.model_eval["tracking_check_auc"] = round(auc(y[ok.to_numpy()], -c.min_dist[ok].to_numpy()), 4)
        self.idx = self.c.set_index(KEY)

    # ---------- tablas de resultados condicionales, con encogimiento jerárquico
    @staticmethod
    def _hier_tables(df: pd.DataFrame, levels: list[list[str]]) -> list[tuple[int, dict]]:
        d = df.assign(comp=df.is_comp, inc=df.is_inc, int=df.is_int, sack=df.is_sack, scr=df.is_scr)
        out: list[tuple[int, dict]] = []
        for i, keys in enumerate(levels):
            g = d.groupby(keys)[OUTCOME_KEYS].sum()
            g["n"] = d.groupby(keys).size()
            t: dict = {}
            for k, row in g.iterrows():
                k = tuple(_py(v) for v in (k if isinstance(k, tuple) else (k,)))
                n = row["n"]
                if i == 0:
                    t[k] = {**{o: row[o] / n for o in OUTCOME_KEYS}, "n": int(n)}
                else:
                    parent = out[i - 1][1][k[: out[i - 1][0]]]
                    t[k] = {**{o: (row[o] + K_CELL * parent[o]) / (n + K_CELL) for o in OUTCOME_KEYS}, "n": int(n)}
            out.append((len(keys), t))
        return out

    @staticmethod
    def _lookup(tables: list[tuple[int, dict]], key: tuple) -> dict[str, float]:
        for depth, t in reversed(tables):
            if key[:depth] in t:
                return t[key[:depth]]
        raise KeyError(key)

    # ---------- métricas agregadas
    def _build_metrics(self) -> None:
        c = self.c
        a = c[c.is_att]

        def split(df: pd.DataFrame) -> list[dict[str, Any]]:
            out = []
            for flag in [False, True]:
                d = df[df.pressure == flag]
                at = d[d.is_att]
                out.append({"pressure": flag, "label": "Con presión" if flag else "Sin presión", "plays": len(d),
                            "comp_pct": at.is_comp.mean(), "ypa": at.yards.mean(), "success": d.success.mean(),
                            "sack_pct": d.is_sack.mean(), "int_pct": at.is_int.mean(),
                            "scramble_pct": d.is_scr.mean(), "yards_per_dropback": d.yards.mean()})
            return out

        lo, hi = bootstrap_diff(a[a.pressure].yards.to_numpy(), a[~a.pressure].yards.to_numpy())
        by_rush = (c.groupby("n_rush_c").agg(plays=("playId", "size"), pressure=("pressure", "mean"),
                                             sack=("is_sack", "mean"), success=("success", "mean"),
                                             yards=("yards", "mean"), p_model=("p_pressure", "mean"))
                   .reset_index().rename(columns={"n_rush_c": "rushers"}))
        by_cov = (a.groupby("pff_passCoverage").agg(attempts=("playId", "size"), comp_pct=("is_comp", "mean"),
                                                   ypa=("yards", "mean"), pressure=("pressure", "mean"),
                                                   int_pct=("is_int", "mean"))
                  .reset_index().rename(columns={"pff_passCoverage": "coverage"}))
        by_cov = by_cov[by_cov.attempts >= 100].sort_values("attempts", ascending=False)
        pa = []
        for flag in [0, 1]:
            d = c[c.pff_playAction == flag]
            at = d[d.is_att]
            pa.append({"label": "Play action" if flag else "Sin play action", "plays": len(d), "ypa": at.yards.mean(),
                       "comp_pct": at.is_comp.mean(), "pressure": d.pressure.mean(), "success": d.success.mean()})
        by_down = (c.groupby(["down_g", "dist_b"]).agg(plays=("playId", "size"), pressure=("pressure", "mean"),
                                                        success=("success", "mean"), sack=("is_sack", "mean")).reset_index())
        by_down["situation"] = by_down.down_g.map({1: "1º", 2: "2º", 3: "3º/4º"}) + " y " + by_down.dist_b

        by_ttt, cost_ttt = [], []
        if self.has_tracking:
            g = c.dropna(subset=["ttt_fine"]).groupby("ttt_fine")
            by_ttt = [{"bucket": b, "plays": len(d), "pressure": d.pressure.mean(), "sack": d.is_sack.mean(),
                       "success": d.success.mean(), "yards": d.yards.mean()}
                      for b in TTT_FINE_LABELS if b in g.groups for d in [g.get_group(b)]]
            for b in RELEASE:
                d = a[a.ttt_b == b]
                x1, x0 = d[d.pressure].yards.to_numpy(), d[~d.pressure].yards.to_numpy()
                l, h = bootstrap_diff(x1, x0)
                cost_ttt.append({"bucket": b, "label": RELEASE_LABELS[b], "attempts": len(d),
                                 "share": len(d) / max(a.ttt_b.notna().sum(), 1), "pressure": d.pressure.mean(),
                                 "ypa_clean": x0.mean(), "ypa_pressure": x1.mean(), "cost": x1.mean() - x0.mean(),
                                 "ci_low": l, "ci_high": h})

        self.summary = _deep_clean({
            "population": {"plays_total": int(len(self.plays_raw)), "plays_analyzed": int(len(c)), "attempts": int(len(a)),
                           "games": int(c.gameId.nunique()), "season": int(self.games.season.iloc[0]),
                           "weeks": [int(self.games.week.min()), int(self.games.week.max())],
                           "excluded": "conversiones de 2 puntos, jugadas con falta y 1 jugada sin rushers",
                           "with_tracking": int(c.ttt.notna().sum())},
            "kpis": {"pressure_rate": c.pressure.mean(), "sack_rate": c.is_sack.mean(),
                     "ypa_pressure": a[a.pressure].yards.mean(), "ypa_clean": a[~a.pressure].yards.mean(),
                     "pressure_cost_ypa": a[a.pressure].yards.mean() - a[~a.pressure].yards.mean(),
                     "pressure_cost_ci": [lo, hi], "ttt_median": c.ttt.median() if self.has_tracking else None},
            "by_pressure": split(c), "by_rushers": records(by_rush), "by_coverage": records(by_cov),
            "play_action": pa, "by_situation": records(by_down[["situation", "plays", "pressure", "success", "sack"]]),
            "by_ttt": by_ttt, "cost_by_release": cost_ttt, "has_tracking": self.has_tracking,
            "pressure_by_release": ({b: c[c.ttt_b == b].pressure.mean() for b in RELEASE} if self.has_tracking else {}),
            "model": self.model_eval,
        })

        # Pass rushers: Empirical Bayes + perfil físico (tracking)
        r = self.rush.merge(c[KEY + ["defensiveTeam"]], on=KEY)
        rr = r.groupby(["nflId", "displayName", "pos"]).agg(
            snaps=("pres", "size"), pressures=("pres", "sum"), sacks=("pff_sack", "sum"),
            hits=("pff_hit", "sum"), hurries=("pff_hurry", "sum"),
            team=("defensiveTeam", lambda s: s.mode().iat[0])).reset_index()
        mu, k = eb_prior_strength(rr.pressures, rr.snaps)
        rr["rate"] = rr.pressures / rr.snaps
        rr["eb_rate"] = (rr.pressures + k * mu) / (rr.snaps + k)
        se = np.sqrt(rr.eb_rate * (1 - rr.eb_rate) / (rr.snaps + k))
        rr["ci_low"], rr["ci_high"] = rr.eb_rate - 1.96 * se, rr.eb_rate + 1.96 * se
        if self.has_tracking:
            tr = self.trk_rush.merge(c[KEY], on=KEY)
            phys = tr.groupby("nflId").agg(close_rate=("t_close", lambda s: s.notna().mean()),
                                           t_close_med=("t_close", "median"), getoff=("speed_1s", "mean"),
                                           min_dist_med=("min_dist", "median")).reset_index()
            phys["nflId"] = phys.nflId.astype(int)
            rr = rr.merge(phys, on="nflId", how="left")
        self.rushers = rr.sort_values("eb_rate", ascending=False)
        self.rush_prior = {"mu": mu, "k": k}

        # Pass blockers: Empirical Bayes sobre la tasa de "vencido"
        b = self.pff[self.pff.pff_role == "Pass Block"].merge(c[KEY + ["possessionTeam"]], on=KEY)
        bb = b.groupby(["nflId", "displayName", "pos"]).agg(
            snaps=("pff_beatenByDefender", "size"), beaten=("pff_beatenByDefender", "sum"),
            sacks_allowed=("pff_sackAllowed", "sum"), hits_allowed=("pff_hitAllowed", "sum"),
            hurries_allowed=("pff_hurryAllowed", "sum"),
            team=("possessionTeam", lambda s: s.mode().iat[0])).reset_index()
        mub, kb = eb_prior_strength(bb.beaten, bb.snaps)
        bb["rate"] = bb.beaten / bb.snaps
        bb["eb_rate"] = (bb.beaten + kb * mub) / (bb.snaps + kb)
        se = np.sqrt(bb.eb_rate * (1 - bb.eb_rate) / (bb.snaps + kb))
        bb["ci_low"], bb["ci_high"] = bb.eb_rate - 1.96 * se, bb.eb_rate + 1.96 * se
        self.blockers = bb.sort_values("eb_rate")
        self.block_prior = {"mu": mub, "k": kb}
        self.blockers_by_pos = records(b.groupby("pos").agg(snaps=("nflId", "size"), beaten=("pff_beatenByDefender", "mean"))
                                       .reset_index().query("snaps >= 100").sort_values("beaten", ascending=False))

        # QBs: costo de la presión + reloj (tracking)
        rows = []
        for (qid, name), d in c.groupby(["qbId", "qb"]):
            at = d[d.is_att]
            ap, an = at[at.pressure].yards.to_numpy(), at[~at.pressure].yards.to_numpy()
            l, h = bootstrap_diff(ap, an, reps=600)
            row = {"nflId": int(qid), "qb": name, "team": d.possessionTeam.mode().iat[0], "dropbacks": len(d),
                   "pressure_rate": d.pressure.mean(), "expected_pressure": d.p_pressure.mean(),
                   "sack_rate": d.is_sack.mean(), "sack_per_pressure": d.is_sack.sum() / max(d.pressure.sum(), 1),
                   "comp_clean": at[~at.pressure].is_comp.mean(), "comp_pressure": at[at.pressure].is_comp.mean(),
                   "ypa_clean": an.mean() if len(an) else None, "ypa_pressure": ap.mean() if len(ap) else None,
                   "success_clean": d[~d.pressure].success.mean(), "success_pressure": d[d.pressure].success.mean(),
                   "pressure_cost": (ap.mean() - an.mean()) if len(ap) and len(an) else None,
                   "cost_ci_low": l, "cost_ci_high": h, "attempts_pressure": len(ap), "attempts_clean": len(an)}
            if self.has_tracking:
                row.update({"ttt_median": d.ttt.median(), "quick_rate": (d.ttt < 2.5).mean(),
                            "dist_release_med": d.dist_release.median()})
                for bkt in RELEASE:
                    s = d[d.ttt_b == bkt]
                    row[f"share_{bkt}"] = len(s) / len(d)
                    row[f"pressure_{bkt}"] = s.pressure.mean() if len(s) >= 10 else None
            rows.append(row)
        self.qbs = pd.DataFrame(rows).sort_values("dropbacks", ascending=False)

        # Equipos: presión observada vs esperada por el modelo
        off = c.groupby("possessionTeam").agg(plays=("playId", "size"), pressure_allowed=("pressure", "mean"),
                                              expected_allowed=("p_pressure", "mean"), sack_allowed=("is_sack", "mean"),
                                              yards=("yards", "mean"), success=("success", "mean"), ttt_median=("ttt", "median"))
        de = c.groupby("defensiveTeam").agg(pressure_generated=("pressure", "mean"), expected_generated=("p_pressure", "mean"),
                                            sack_generated=("is_sack", "mean"), yards_allowed=("yards", "mean"),
                                            avg_rushers=("n_rush", "mean"))
        t = off.join(de).reset_index().rename(columns={"possessionTeam": "team"})
        t["pressure_allowed_oe"] = t.pressure_allowed - t.expected_allowed
        t["pressure_generated_oe"] = t.pressure_generated - t.expected_generated
        self.teams = t

    # ---------- consultas
    def list_plays(self, team: str | None, week: int | None, pressure: str | None, down: int | None,
                   q: str | None, limit: int) -> dict[str, Any]:
        d = self.c
        if team:
            d = d[(d.possessionTeam == team) | (d.defensiveTeam == team)]
        if week:
            d = d[d.week == week]
        if down:
            d = d[d.down == down]
        if pressure in ("yes", "no"):
            d = d[d.pressure == (pressure == "yes")]
        if q:
            d = d[d.playDescription.str.contains(q, case=False, regex=False) | d.qb.fillna("").str.contains(q, case=False, regex=False)]
        cols = KEY + ["week", "quarter", "gameClock", "down", "yardsToGo", "possessionTeam", "defensiveTeam",
                      "passResult", "yards", "pressure", "n_rush", "qb", "ttt", "playDescription"]
        return {"total": int(len(d)), "plays": records(d.sort_values(KEY)[cols].head(limit))}

    def frames(self, game_id: int, play_id: int) -> dict[str, Any]:
        if (game_id, play_id) not in self.idx.index:
            raise KeyError("jugada no encontrada en la población analizada")
        f = self.pff[(self.pff.gameId == game_id) & (self.pff.playId == play_id)]
        s = self.idx.loc[(game_id, play_id)]
        return tracking.play_frames(game_id, play_id, f, {"yardsToGo": s.yardsToGo})

    def _p_pressure(self, row: pd.DataFrame, rushers: int, release: str | None) -> float:
        r = row.copy()
        r["n_rush_c"] = rushers
        if release and self.model_b is not None:
            r["ttt_b"] = release
            return float(self.model_b.predict(r)[0])
        return float(self.model.predict(r)[0])

    def _outcomes(self, pressure: bool, s: pd.Series, release: str | None) -> dict[str, float]:
        if release and self.tables_ttt:
            return self._lookup(self.tables_ttt, (pressure, release, int(s.down_g), s.dist_b, s.cov_type))
        return self._lookup(self.tables, (pressure, int(s.down_g), s.dist_b, s.cov_type))

    @staticmethod
    def _mix(p: float, o1: dict[str, float], o0: dict[str, float]) -> dict[str, float]:
        return {k: p * o1[k] + (1 - p) * o0[k] for k in OUTCOME_KEYS}

    def _scenario(self, row: pd.DataFrame, s: pd.Series, rushers: int, pressure: str, release: str | None):
        p = {"yes": 1.0, "no": 0.0}.get(pressure, self._p_pressure(row, rushers, release))
        o1, o0 = self._outcomes(True, s, release), self._outcomes(False, s, release)
        return p, self._mix(p, o1, o0), o1, o0

    def simulate(self, game_id: int, play_id: int, rushers: int | None, pressure: str, release: str) -> dict[str, Any]:
        if (game_id, play_id) not in self.idx.index:
            raise KeyError("jugada no encontrada en la población analizada")
        row = self.idx.loc[[(game_id, play_id)]].reset_index()
        s = row.iloc[0]
        rel = release if (release in RELEASE and self.model_b is not None) else None
        actual_r = int(s.n_rush_c)
        sim_r = int(np.clip(rushers if rushers else actual_r, RUSH_LEVELS[0], RUSH_LEVELS[-1]))

        p_actual, expected, _, _ = self._scenario(row, s, actual_r, "auto", None)
        p_sim, simulated, o1, o0 = self._scenario(row, s, sim_r, pressure, rel)

        curve = []
        for r in RUSH_LEVELS:
            pr, m, _, _ = self._scenario(row, s, r, "auto", rel)
            curve.append({"rushers": r, "p_pressure": pr, "yards": m["yards"], "sack": m["sack"],
                          "success": m["success"], "comp": m["comp"]})
        release_curve = []
        if self.model_b is not None:
            for b in RELEASE:
                pr, m, _, _ = self._scenario(row, s, sim_r, pressure, b)
                release_curve.append({"release": b, "label": RELEASE_LABELS[b], "p_pressure": pr, "yards": m["yards"],
                                      "sack": m["sack"], "success": m["success"], "comp": m["comp"]})

        ttt = None if pd.isna(s.ttt) else float(s.ttt)
        real = {"passResult": s.passResult, "result_label": RESULT_LABELS.get(s.passResult, s.passResult),
                "yards": s.yards, "success": bool(s.success), "pressure": bool(s.pressure), "rushers": int(s.n_rush),
                "comp": bool(s.is_comp), "sack": bool(s.is_sack), "int": bool(s.is_int), "scr": bool(s.is_scr),
                "inc": bool(s.is_inc), "ttt": ttt, "release": s.ttt_b if isinstance(s.ttt_b, str) else None,
                "dist_release": _clean(s.dist_release), "t_first_close": _clean(s.t_first_close)}
        play = {"gameId": int(s.gameId), "playId": int(s.playId), "week": int(s.week), "quarter": int(s.quarter),
                "gameClock": s.gameClock, "down": int(s.down), "yardsToGo": int(s.yardsToGo),
                "yards_to_goal": int(s.yards_to_goal), "score_diff": int(s.score_diff),
                "offense": s.possessionTeam, "defense": s.defensiveTeam, "qb": s.qb,
                "formation": s.offenseFormation, "personnelO": s.personnelO, "personnelD": s.personnelD,
                "defendersInBox": _clean(s.defendersInBox), "coverage": s.pff_passCoverage, "coverage_type": s.cov_type,
                "play_action": bool(s.pff_playAction), "dropBackType": s.dropBackType if isinstance(s.dropBackType, str) else None,
                "description": s.playDescription}
        return _deep_clean({
            "play": play, "real": real,
            "participants": self._participants(int(s.gameId), int(s.playId)),
            "model": {"p_pressure_actual": p_actual, "cell_n_pressure": o1["n"], "cell_n_clean": o0["n"]},
            "expected": expected, "simulated": simulated,
            "scenario": {"rushers": sim_r, "pressure_mode": pressure, "release": rel or "auto", "p_pressure": p_sim},
            "deltas": {k: simulated[k] - expected[k] for k in OUTCOME_KEYS},
            "curve": curve, "release_curve": release_curve, "has_tracking": self.has_tracking,
        })

    def _participants(self, g: int, pid: int) -> dict[str, Any]:
        f = self.pff[(self.pff.gameId == g) & (self.pff.playId == pid)]
        names = self.players.set_index("nflId").displayName
        rushers = [{"nflId": int(r.nflId), "name": r.displayName, "pos": r.pos, "aligned": r.pff_positionLinedUp,
                    "hit": bool(r.pff_hit == 1), "hurry": bool(r.pff_hurry == 1), "sack": bool(r.pff_sack == 1)}
                   for r in f[f.pff_role == "Pass Rush"].itertuples()]
        blockers = [{"nflId": int(r.nflId), "name": r.displayName, "pos": r.pos, "aligned": r.pff_positionLinedUp,
                     "beaten": bool(r.pff_beatenByDefender == 1),
                     "allowed": [lbl for lbl, col in [("sack", r.pff_sackAllowed), ("hit", r.pff_hitAllowed),
                                                      ("hurry", r.pff_hurryAllowed)] if col == 1],
                     "blocked": names.get(r.pff_nflIdBlockedPlayer) if pd.notna(r.pff_nflIdBlockedPlayer) else None}
                    for r in f[f.pff_role == "Pass Block"].itertuples()]
        return {"rushers": rushers, "blockers": blockers}
