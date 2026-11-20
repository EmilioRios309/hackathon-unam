"""EDA inicial (solo lectura). Uso: .venv\\Scripts\\python backend\\scripts\\eda_inicial.py
Genera docs/eda_inicial.md. No modifica data/."""
from pathlib import Path
import io
import pandas as pd
import numpy as np

RAIZ = Path(__file__).resolve().parents[2]
DATA = RAIZ / "data"
SALIDA = RAIZ / "docs" / "eda_inicial.md"
out = io.StringIO()


def w(t=""):
    out.write(t + "\n")


def md(df):
    return df.to_markdown(index=False) if _tiene_tabulate() else "```\n" + df.to_string(index=False) + "\n```"


def _tiene_tabulate():
    try:
        import tabulate  # noqa
        return True
    except ImportError:
        return False


dfs = {p.stem: pd.read_csv(p, low_memory=False) for p in sorted(DATA.glob("*.csv"))}

w("# EDA inicial\n")
w("Generado por `backend/scripts/eda_inicial.py`. Los archivos de `data/` no se modifican.\n")
w("## Archivos\n")
filas = [(k, f"{k}.csv", len(d), d.shape[1], round(d.memory_usage(deep=True).sum() / 1e6, 2)) for k, d in dfs.items()]
w(md(pd.DataFrame(filas, columns=["dataset", "archivo", "filas", "columnas", "memoria_MB"])))

for nombre, d in dfs.items():
    w(f"\n## {nombre}\n")
    w(f"Dimensiones: {d.shape[0]:,} filas x {d.shape[1]} columnas. Duplicados exactos: {int(d.duplicated().sum())}.\n")
    perfil = pd.DataFrame({
        "columna": d.columns,
        "dtype": d.dtypes.astype(str).values,
        "nulos_%": (d.isna().mean() * 100).round(2).values,
        "unicos": d.nunique().values,
        "ejemplo": [str(d[c].dropna().iloc[0]) if d[c].notna().any() else "" for c in d.columns],
    })
    w(md(perfil))
    num = d.select_dtypes(include=np.number)
    if not num.empty:
        w("\nEstadÃ­sticas numÃ©ricas:\n")
        w(md(num.describe().T.round(2).reset_index().rename(columns={"index": "columna"})))
        neg = (num < 0).sum()
        neg = neg[neg > 0]
        if len(neg):
            w("\nColumnas con valores negativos (revisar si son legÃ­timos):\n")
            w(md(neg.rename("negativos").reset_index().rename(columns={"index": "columna"})))

# Claves duplicadas
w("\n## Integridad de claves\n")
claves = {"games": ["gameId"], "players": ["nflId"], "plays": ["gameId", "playId"],
          "pffScoutingData": ["gameId", "playId", "nflId"]}
for k, cols in claves.items():
    if k in dfs and all(c in dfs[k].columns for c in cols):
        w(f"- {k}: clave {cols}, duplicados de clave = {int(dfs[k].duplicated(cols).sum())}")
if {"games", "plays"} <= dfs.keys():
    w(f"- plays con gameId ausente en games: {int((~dfs['plays'].gameId.isin(dfs['games'].gameId)).sum())}")
if {"players", "pffScoutingData"} <= dfs.keys():
    w(f"- pffScoutingData con nflId ausente en players: {int((~dfs['pffScoutingData'].nflId.isin(dfs['players'].nflId)).sum())}")
if {"plays", "pffScoutingData"} <= dfs.keys():
    k = dfs["plays"][["gameId", "playId"]].drop_duplicates()
    m = dfs["pffScoutingData"].merge(k, how="left", on=["gameId", "playId"], indicator=True)
    w(f"- pffScoutingData sin jugada en plays: {int((m._merge == 'left_only').sum())}")

# Temporadas
w("\n## Registros por temporada\n")
g = dfs.get("games")
if g is not None and "season" in g:
    s = g.groupby("season").agg(juegos=("gameId", "nunique"), semana_min=("week", "min"), semana_max=("week", "max"),
                                semanas=("week", "nunique")).reset_index()
    if "plays" in dfs:
        pj = dfs["plays"].merge(g[["gameId", "season"]], on="gameId", how="left").groupby("season").size().rename("jugadas")
        s = s.merge(pj, on="season", how="left")
    if "pffScoutingData" in dfs:
        pf = dfs["pffScoutingData"].merge(g[["gameId", "season"]], on="gameId", how="left").groupby("season").size().rename("registros_pff")
        s = s.merge(pf, on="season", how="left")
    w(md(s))
    fuera = g[(g.season < 2010) | (g.season > 2026)]
    w(f"\nJuegos con season fuera de 2010-2026: {len(fuera)}")
    if "gameDate" in g:
        f = pd.to_datetime(g.gameDate, format="%m/%d/%Y", errors="coerce")
        w(f"Fechas invÃ¡lidas en gameDate: {int(f.isna().sum())}. Rango: {f.min().date()} a {f.max().date()}")
        w(f"Fechas con aÃ±o distinto a season (por fecha, enero-febrero pertenece a la temporada previa): "
          f"{int((f.dt.year - (f.dt.month <= 2).astype(int) != g.season).sum())}")
    w("\nJuegos por semana:\n")
    w(md(g.groupby("week").size().rename("juegos").reset_index()))

# Posiciones
w("\n## Registros por posiciÃ³n\n")
p = dfs.get("players")
if p is not None:
    for c in [c for c in p.columns if "osition" in c]:
        w(f"\nplayers.{c}:\n")
        w(md(p[c].value_counts(dropna=False).rename("jugadores").reset_index().rename(columns={c: c})))
    if "pffScoutingData" in dfs and "officialPosition" in p:
        m = dfs["pffScoutingData"].merge(p[["nflId", "officialPosition"]], on="nflId", how="left")
        w("\nRegistros pffScoutingData por officialPosition:\n")
        w(md(m.officialPosition.value_counts(dropna=False).rename("registros").reset_index()))
    if "pffScoutingData" in dfs and "pff_positionLinedUp" in dfs["pffScoutingData"]:
        w("\nRegistros pffScoutingData por pff_positionLinedUp:\n")
        w(md(dfs["pffScoutingData"].pff_positionLinedUp.value_counts(dropna=False).rename("registros").reset_index()))
    if "height" in p:
        h = p.height.astype(str)
        w(f"\nFormatos de height distintos de 'pies-pulgadas': {int((~h.str.match(r'^\d+-\d+$')).sum())}")
    if "weight" in p:
        w(f"Peso fuera de 150-450 lb: {int(((p.weight < 150) | (p.weight > 450)).sum())}")
    if "birthDate" in p:
        b = pd.to_datetime(p.birthDate, errors="coerce", format="mixed")
        w(f"birthDate nulo/ilegible: {int(b.isna().sum())}. Formatos mezclados: {p.birthDate.dropna().astype(str).str.len().value_counts().to_dict()}")

# Chequeos de jugadas
pl = dfs.get("plays")
if pl is not None:
    w("\n## Chequeos de rango en plays\n")
    for c, lo, hi in [("quarter", 1, 5), ("down", 0, 4), ("yardsToGo", 0, 50), ("yardlineNumber", 0, 50),
                      ("preSnapHomeScore", 0, 100), ("preSnapVisitorScore", 0, 100), ("playResult", -30, 99),
                      ("offensePlayResult", -30, 99), ("absoluteYardlineNumber", 0, 120), ("defendersInBox", 0, 11)]:
        if c in pl:
            w(f"- {c}: fuera de [{lo}, {hi}] = {int(((pl[c] < lo) | (pl[c] > hi)).sum())}, nulos = {int(pl[c].isna().sum())}")

w("""
## Hallazgos y pendientes de limpieza (revisión manual)

- Cobertura: solo temporada 2021, semanas 1 a 8 (122 juegos). Las semanas 6 a 8 tienen 13 a 15 juegos (descansos). Ningún año cae fuera de 2010-2026.
- No hay datos de tracking (x, y, velocidad). Solo games, plays, players y pffScoutingData.
- Nulos estructurales en pffScoutingData: pff_hit, pff_hurry y pff_sack existen solo para pass rushers (50% nulos). Los campos *Allowed y pff_beatenByDefender existen solo para pass blockers (74% nulos). No imputar con 0 sin filtrar por pff_role.
- plays: down = 0 en 35 jugadas (probables conversiones de 2 puntos o jugadas especiales). quarter = 5 en 98 (tiempo extra). penaltyYards y foul* son nulos cuando no hay falta.
- plays: yardlineSide nulo 1.46%, dropBackType nulo 6.17%, defendersInBox nulo en 7, absoluteYardlineNumber nulo en 1, offenseFormation nulo en 6.
- Los negativos de playResult, prePenaltyPlayResult y penaltyYards son legítimos (sacks, pérdidas, faltas).
- players: birthDate nulo 13.8% y collegeName nulo 13.3%. height es texto "pies-pulgadas" (ej. 6-4) y hay que convertirlo a pulgadas. officialPosition incluye LB (2) y DB (2) genéricos junto a ILB/OLB/MLB y CB/FS/SS.
- pff_positionLinedUp tiene 56 valores (izquierda/derecha, slot); conviene agruparlos.
- playId no es único (3762 valores en 8557 jugadas). La clave es (gameId, playId).
- Sin duplicados exactos ni de clave, y sin llaves huérfanas entre tablas.
""")

SALIDA.parent.mkdir(exist_ok=True)
SALIDA.write_text(out.getvalue(), encoding="utf-8")
print(f"Escrito {SALIDA}")
