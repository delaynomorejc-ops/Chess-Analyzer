export type ErrorType = '战术' | '战略' | '心理';
export type TrendLabel = '系统性弱点' | '不稳定' | '改善中' | '稳定';
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export interface BlunderEntry {
  move: number;
  type: ErrorType;
  magnitude: number;
  actualMove: string;
  bestMove: string;
}

export interface PhaseAcl {
  opening: number;
  middlegame: number;
  endgame: number;
}

export interface PhaseBoundaries {
  opening_end: number;
  endgame_start: number;
}

export interface GameSummary {
  game_id: string;
  date: string;
  result: GameResult;
  eco: string;
  opening: string;
  player_color: 'white' | 'black';
  score_curve: number[];
  phase_acl: PhaseAcl;
  phase_boundaries: PhaseBoundaries;
  blunders: BlunderEntry[];
  zombie_pieces: string[];
  plan_break_move: number | null;
  novelty_point: number | null;
  endgame_result: string | null;
  opening_category_ids: string[];
  pgn: string;
  claude_summary: string | null;
  white_player: string;
  black_player: string;
}

export interface MoveAnalysis {
  fen: string;
  san: string;
  score: number | null;
  bestMove: string | null;
  delta: number;
  errorType: ErrorType | null;
  moveNumber: number;
  color: 'white' | 'black';
}

export interface PieceActivity {
  piece: string;
  square: string;
  moveCount: number;
  isZombie: boolean;
  trappedSince: number | null;
}

export interface SilmanImbalance {
  pawnStructure: number;
  pieceQuality: number;
  openFiles: number;
  space: number;
  kingSafety: number;
  development: number;
}

export interface OpeningCategory {
  id: string;
  name: string;
  color: 'white' | 'black' | 'both';
  moves: string[];
  parent_id: string | null;
  created_at: string;
  description?: string;
}

export interface OpeningStats {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  win_rate: number;
  avg_acl_opening: number;
  avg_novelty_move: number;
  trend: TrendLabel;
}

export interface TrainingPlan {
  id: string;
  created_at: string;
  days_to_tournament: number;
  weekly_hours: number;
  session_minutes: number;
  has_coach: boolean;
  content: string;
  games_count: number;
}

export interface AggregatedStats {
  total_games: number;
  date_range: string;
  error_type_trend: {
    tactical: number[];
    strategic: number[];
    psychological: number[];
  };
  phase_acl_avg: PhaseAcl;
  phase_acl_per_game: PhaseAcl[];
  zombie_rate_per_game: number[];
  plan_break_per_game: (number | null)[];
  indicator_trends: {
    zombie_piece_rate: TrendLabel;
    plan_break_move: TrendLabel;
    tactical_errors: TrendLabel;
    strategic_errors: TrendLabel;
    psychological_errors: TrendLabel;
  };
  opening_stats: Record<string, OpeningStats>;
  weakest_openings: string[];
}
