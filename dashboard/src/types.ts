export interface Play {
  play_id: number;
  quarter: number;
  time_remaining: string;
  down: number;
  ydstogo: number;
  yardline_100: number;
  possession_team: string;
  defensive_team: string;
  score_differential: number;
  actual_play_type: string;
  actual_target_gap: string;
  actual_defense_coverage: string;
  actual_blitz_count: number;
  actual_yards_gained: number;
  actual_epa: number;
  play_description: string;
}

export interface OffensiveSimResult {
  actual_play: {
    play_type: string;
    target_gap: string;
    yards_gained: number;
    epa: number;
  };
  simulated_play: {
    play_type: string;
    target_gap: string;
    expected_completion_prob: number;
    expected_yards: number;
    expected_success_prob: number;
    simulated_epa: number;
  };
  deltas: {
    delta_yards: number;
    delta_epa: number;
    delta_success_prob: number;
  };
  tactical_narrative: string;
}

export interface DefensiveSimResult {
  actual_defense: {
    coverage: string;
    blitz_count: number;
    yards_allowed: number;
    epa_allowed: number;
  };
  simulated_defense: {
    coverage: string;
    blitz_count: number;
    expected_yards_allowed: number;
    simulated_epa_allowed: number;
  };
  deltas: {
    yards_prevented: number;
    epa_prevented: number;
  };
  tactical_narrative: string;
}