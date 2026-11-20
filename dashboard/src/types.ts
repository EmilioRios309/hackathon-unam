export interface PressureSplit {
  pressure: boolean;
  label: string;
  plays: number;
  comp_pct: number;
  ypa: number;
  success: number;
  sack_pct: number;
  int_pct: number;
  scramble_pct: number;
  yards_per_dropback: number;
}

export interface Summary {
  population: {
    with_tracking: number;
    plays_total: number;
    plays_analyzed: number;
    attempts: number;
    games: number;
    season: number;
    weeks: [number, number];
    excluded: string;
  };
  kpis: {
    pressure_rate: number;
    sack_rate: number;
    ypa_pressure: number;
    ypa_clean: number;
    pressure_cost_ypa: number;
    pressure_cost_ci: [number, number];
    ttt_median: number | null;
  };
  by_pressure: PressureSplit[];
  by_rushers: { rushers: number; plays: number; pressure: number; sack: number; success: number; yards: number; p_model: number }[];
  by_coverage: { coverage: string; attempts: number; comp_pct: number; ypa: number; pressure: number; int_pct: number }[];
  play_action: { label: string; plays: number; ypa: number; comp_pct: number; pressure: number; success: number }[];
  by_week: { week: number; plays: number; pressure: number; yards: number; sack: number }[];
  by_situation: { situation: string; plays: number; pressure: number; success: number; sack: number }[];
  by_ttt: { bucket: string; plays: number; pressure: number; sack: number; success: number; yards: number }[];
  cost_by_release: {
    bucket: Release;
    label: string;
    attempts: number;
    share: number;
    pressure: number;
    ypa_clean: number;
    ypa_pressure: number;
    cost: number;
    ci_low: number;
    ci_high: number;
  }[];
  has_tracking: boolean;
  pressure_by_release: Partial<Record<Release, number>>;
  model: {
    target: string;
    n_train: number;
    n_test: number;
    games_test: number;
    positive_rate: number;
    auc: number;
    brier: number;
    brier_baseline: number;
    auc_without_rushers: number;
    coefficients: { feature: string; coef: number }[];
    release_model?: { auc: number; brier: number; brier_baseline: number; n_test: number; games_test: number };
    tracking_check_auc?: number;
  };
}

export type Release = 'rapido' | 'normal' | 'largo';
export type ReleaseMode = 'auto' | Release;

export interface Rusher {
  nflId: number;
  displayName: string;
  pos: string;
  team: string;
  snaps: number;
  pressures: number;
  sacks: number;
  hits: number;
  hurries: number;
  rate: number;
  eb_rate: number;
  ci_low: number;
  ci_high: number;
  close_rate?: number | null;
  t_close_med?: number | null;
  getoff?: number | null;
}

export interface Blocker {
  nflId: number;
  displayName: string;
  pos: string;
  team: string;
  snaps: number;
  beaten: number;
  sacks_allowed: number;
  hits_allowed: number;
  hurries_allowed: number;
  rate: number;
  eb_rate: number;
  ci_low: number;
  ci_high: number;
}

export interface Prior {
  mu: number;
  k: number;
}

export interface QB {
  nflId: number;
  qb: string;
  team: string;
  dropbacks: number;
  pressure_rate: number;
  expected_pressure: number;
  sack_rate: number;
  sack_per_pressure: number;
  comp_clean: number;
  comp_pressure: number;
  ypa_clean: number;
  ypa_pressure: number;
  success_clean: number;
  success_pressure: number;
  pressure_cost: number;
  cost_ci_low: number;
  cost_ci_high: number;
  attempts_pressure: number;
  attempts_clean: number;
  ttt_median?: number | null;
  quick_rate?: number | null;
  dist_release_med?: number | null;
  share_rapido?: number;
  share_normal?: number;
  share_largo?: number;
  pressure_rapido?: number | null;
  pressure_normal?: number | null;
  pressure_largo?: number | null;
}

export interface Team {
  team: string;
  plays: number;
  pressure_allowed: number;
  expected_allowed: number;
  sack_allowed: number;
  yards: number;
  success: number;
  pressure_generated: number;
  expected_generated: number;
  sack_generated: number;
  yards_allowed: number;
  avg_rushers: number;
  pressure_allowed_oe: number;
  pressure_generated_oe: number;
}

export interface PlayRow {
  gameId: number;
  playId: number;
  week: number;
  quarter: number;
  gameClock: string;
  down: number;
  yardsToGo: number;
  possessionTeam: string;
  defensiveTeam: string;
  passResult: string;
  yards: number;
  pressure: boolean;
  n_rush: number;
  qb: string | null;
  ttt: number | null;
  playDescription: string;
}

export interface Outcomes {
  comp: number;
  inc: number;
  int: number;
  sack: number;
  scr: number;
  success: number;
  yards: number;
}

export interface SimResult {
  play: {
    gameId: number;
    playId: number;
    week: number;
    quarter: number;
    gameClock: string;
    down: number;
    yardsToGo: number;
    yards_to_goal: number;
    score_diff: number;
    offense: string;
    defense: string;
    qb: string | null;
    formation: string | null;
    personnelO: string | null;
    personnelD: string | null;
    defendersInBox: number | null;
    coverage: string;
    coverage_type: string;
    play_action: boolean;
    dropBackType: string | null;
    description: string;
  };
  real: {
    passResult: string;
    result_label: string;
    yards: number;
    success: boolean;
    pressure: boolean;
    rushers: number;
    comp: boolean;
    sack: boolean;
    int: boolean;
    scr: boolean;
    inc: boolean;
    ttt: number | null;
    release: Release | null;
    dist_release: number | null;
    t_first_close: number | null;
  };
  participants: {
    rushers: { nflId: number; name: string; pos: string; aligned: string; hit: boolean; hurry: boolean; sack: boolean }[];
    blockers: { nflId: number; name: string; pos: string; aligned: string; beaten: boolean; allowed: string[]; blocked: string | null }[];
  };
  model: { p_pressure_actual: number; cell_n_pressure: number; cell_n_clean: number };
  expected: Outcomes;
  simulated: Outcomes;
  scenario: { rushers: number; pressure_mode: PressureMode; release: ReleaseMode; p_pressure: number };
  deltas: Outcomes;
  curve: { rushers: number; p_pressure: number; yards: number; sack: number; success: number; comp: number }[];
  release_curve: { release: Release; label: string; p_pressure: number; yards: number; sack: number; success: number; comp: number }[];
  has_tracking: boolean;
}

export interface FramePlayer {
  i: number;
  nflId: number;
  name: string;
  pos: string;
  aligned: string;
  jersey: number | null;
  role: 'Pass' | 'Pass Block' | 'Pass Route' | 'Pass Rush' | 'Coverage' | 'Otro';
  side: 'off' | 'def';
  hit: boolean;
  hurry: boolean;
  sack: boolean;
  beaten: boolean;
  blocked: number | null;
  block_type: string | null;
}

export interface PlayFrames {
  gameId: number;
  playId: number;
  los: number;
  first_down: number;
  end_t: number;
  end_label: string;
  qb: number | null;
  close_yd: number;
  players: FramePlayer[];
  frames: { f: number; t: number; ball: [number, number] | null; p: ([number, number, number] | null)[] }[];
  qb_dist: { t: number; d: number; who: number }[];
  events: { t: number; label: string }[];
}

export type PressureMode = 'auto' | 'yes' | 'no';
export type Perspective = 'offense' | 'defense';
