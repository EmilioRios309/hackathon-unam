from pathlib import Path
import pandas as pd

class DataIngestionLayer:
    """Capa de ingesta tolerante a esquemas parciales o columnas faltantes."""
    
    REQUIRED_COLUMNS = [
        "play_id", "quarter", "time_remaining", "down", "ydstogo", 
        "yardline_100", "possession_team", "defensive_team", 
        "score_differential", "play_type", "target_gap", 
        "defense_coverage", "blitz_count", "yards_gained", "epa", "description"
    ]

    def __init__(self, data_path: str = "data/nfl_sample.csv"):
        self.data_path = Path(data_path)

    def load_and_normalize(self) -> pd.DataFrame:
        if not self.data_path.exists():
            raise FileNotFoundError(f"No se encontró el dataset en: {self.data_path}")

        df = pd.read_csv(self.data_path)
        
        # Valores por defecto para tolerancia a esquemas incompletos
        defaults = {
            "quarter": 1, "time_remaining": "15:00", "down": 1, "ydstogo": 10,
            "yardline_100": 75, "score_differential": 0, "play_type": "pass",
            "target_gap": "short_middle", "defense_coverage": "cover_3",
            "blitz_count": 4, "yards_gained": 0.0, "epa": 0.0,
            "description": "Jugada sin descripción"
        }
        for col, default_val in defaults.items():
            if col not in df.columns:
                df[col] = default_val

        # Mapeo y estandarización de columnas
        df = df.rename(columns={
            "play_type": "actual_play_type",
            "target_gap": "actual_target_gap",
            "defense_coverage": "actual_defense_coverage",
            "blitz_count": "actual_blitz_count",
            "yards_gained": "actual_yards_gained",
            "epa": "actual_epa",
            "description": "play_description"
        })

        return df