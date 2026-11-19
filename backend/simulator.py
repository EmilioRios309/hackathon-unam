import numpy as np
import pandas as pd
from typing import Dict, Any

class CounterfactualSimulator:
    """Motor de simulación contrafactual estocástica (Ofensiva y Defensiva)."""

    OFFENSIVE_BASE_RATES = {
        "checkdown": {"completion_prob": 0.92, "avg_yards": 4.5, "variance": 1.5},
        "short_left": {"completion_prob": 0.78, "avg_yards": 6.2, "variance": 2.1},
        "short_middle": {"completion_prob": 0.75, "avg_yards": 7.5, "variance": 2.8},
        "short_right": {"completion_prob": 0.76, "avg_yards": 6.0, "variance": 2.0},
        "deep_left": {"completion_prob": 0.42, "avg_yards": 18.5, "variance": 6.0},
        "deep_middle": {"completion_prob": 0.48, "avg_yards": 22.0, "variance": 7.2},
        "deep_right": {"completion_prob": 0.40, "avg_yards": 17.8, "variance": 5.8},
        "zone_left": {"completion_prob": 1.0, "avg_yards": 4.1, "variance": 1.8},
        "power_right": {"completion_prob": 1.0, "avg_yards": 3.8, "variance": 1.2},
        "qb_scramble": {"completion_prob": 1.0, "avg_yards": 5.5, "variance": 3.0},
    }

    DEFENSIVE_COVERAGE_MODIFIERS = {
        "cover_0": {"completion_mult": 1.15, "yards_mult": 1.25, "risk": "high"},
        "cover_1": {"completion_mult": 0.95, "yards_mult": 1.05, "risk": "med"},
        "cover_2": {"completion_mult": 0.90, "yards_mult": 0.85, "risk": "low"},
        "cover_3": {"completion_mult": 0.88, "yards_mult": 0.90, "risk": "low"},
        "cover_4": {"completion_mult": 0.82, "yards_mult": 0.70, "risk": "safe"},
        "cover_2_man": {"completion_mult": 0.85, "yards_mult": 0.80, "risk": "med"},
        "blitz_zero": {"completion_mult": 1.10, "yards_mult": 1.30, "risk": "extreme"},
    }

    @staticmethod
    def _calculate_epa(yardline: float, down: int, ydstogo: float, yards_gained: float) -> float:
        """Estimación aproximada de Puntos Esperados (EPA)."""
        is_first_down = 1.0 if yards_gained >= ydstogo else -0.3
        return round((yards_gained * 0.08) + is_first_down - (down * 0.15), 2)

    def simulate_offensive_scenario(
        self, play_row: pd.Series, sim_play_type: str, sim_target_gap: str, aggressiveness: float = 1.0
    ) -> Dict[str, Any]:
        """Simula alternativas tácticas de la ofensiva."""
        actual_yards = float(play_row["actual_yards_gained"])
        actual_epa = float(play_row["actual_epa"])
        ydstogo = float(play_row["ydstogo"])
        yardline = float(play_row["yardline_100"])

        base_data = self.OFFENSIVE_BASE_RATES.get(
            sim_target_gap, {"completion_prob": 0.70, "avg_yards": 5.0, "variance": 2.0}
        )

        cov_mod = self.DEFENSIVE_COVERAGE_MODIFIERS.get(
            str(play_row["actual_defense_coverage"]), {"completion_mult": 1.0, "yards_mult": 1.0}
        )

        exp_completion = min(0.98, max(0.20, base_data["completion_prob"] * cov_mod["completion_mult"]))
        exp_yards = round(base_data["avg_yards"] * cov_mod["yards_mult"] * aggressiveness, 1)

        success_prob = round(exp_completion if exp_yards >= ydstogo else exp_completion * 0.6, 2)
        simulated_epa = self._calculate_epa(yardline, int(play_row["down"]), ydstogo, exp_yards)

        delta_yards = round(exp_yards - actual_yards, 1)
        delta_epa = round(simulated_epa - actual_epa, 2)

        return {
            "actual_play": {
                "play_type": play_row["actual_play_type"],
                "target_gap": play_row["actual_target_gap"],
                "yards_gained": actual_yards,
                "epa": actual_epa,
            },
            "simulated_play": {
                "play_type": sim_play_type,
                "target_gap": sim_target_gap,
                "expected_completion_prob": exp_completion,
                "expected_yards": exp_yards,
                "expected_success_prob": success_prob,
                "simulated_epa": simulated_epa,
            },
            "deltas": {
                "delta_yards": delta_yards,
                "delta_epa": delta_epa,
                "delta_success_prob": round(success_prob - (1.0 if actual_yards >= ydstogo else 0.2), 2),
            },
            "tactical_narrative": (
                f"Cambiando a {sim_play_type} ({sim_target_gap}): "
                f"Se proyectan {exp_yards} yds esperadas con probabilidad de éxito del {int(success_prob*100)}%. "
                f"Impacto en EPA: {delta_epa:+.2f} pts."
            )
        }

    def simulate_defensive_scenario(
        self, play_row: pd.Series, sim_coverage: str, sim_blitz_count: int
    ) -> Dict[str, Any]:
        """Simula ajustes del esquema defensivo."""
        actual_yards = float(play_row["actual_yards_gained"])
        actual_epa = float(play_row["actual_epa"])
        ydstogo = float(play_row["ydstogo"])

        cov_mod = self.DEFENSIVE_COVERAGE_MODIFIERS.get(sim_coverage, {"completion_mult": 1.0, "yards_mult": 1.0})
        blitz_factor = 1.0 - (sim_blitz_count - 4) * 0.06

        exp_yards_allowed = round(max(0.0, actual_yards * cov_mod["yards_mult"] * blitz_factor), 1)
        simulated_epa_allowed = self._calculate_epa(
            float(play_row["yardline_100"]), int(play_row["down"]), ydstogo, exp_yards_allowed
        )

        yards_prevented = round(actual_yards - exp_yards_allowed, 1)
        epa_prevented = round(actual_epa - simulated_epa_allowed, 2)

        return {
            "actual_defense": {
                "coverage": play_row["actual_defense_coverage"],
                "blitz_count": int(play_row["actual_blitz_count"]),
                "yards_allowed": actual_yards,
                "epa_allowed": actual_epa,
            },
            "simulated_defense": {
                "coverage": sim_coverage,
                "blitz_count": sim_blitz_count,
                "expected_yards_allowed": exp_yards_allowed,
                "simulated_epa_allowed": simulated_epa_allowed,
            },
            "deltas": {
                "yards_prevented": yards_prevented,
                "epa_prevented": epa_prevented,
            },
            "tactical_narrative": (
                f"Ajustando defensa a {sim_coverage} con {sim_blitz_count} pass rushers: "
                f"Las yardas permitidas cambiarían de {actual_yards} a {exp_yards_allowed} yds, "
                f"previniendo {epa_prevented:+.2f} de EPA."
            )
        }