// ─── Shared Types ───

export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  balance: number;
  is_guest: boolean;
  total_winnings?: number;
  total_hands_played?: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Card {
  rank: string;
  suit: string;
}

export interface PlayerInfo {
  id: string;
  display_name: string;
  avatar_url: string | null;
  chips: number;
  seat: number;
  is_folded: boolean;
  is_all_in: boolean;
  is_sitting_out: boolean;
  current_bet: number;
  is_dealer: boolean;
  current_hand_rank?: string;
}

export interface JoinRequestInfo {
  player_id: string;
  display_name: string;
  buy_in: number;
}

export interface GameState {
  table_id: string;
  status: string;
  phase: string | null;
  community_cards: Card[];
  pot: number;
  current_bet: number;
  action_on: string | null;
  dealer_seat: number | null;
  players: PlayerInfo[];
  small_blind: number;
  big_blind: number;
  hand_number: number | null;
  server_seed_hash: string | null;
  creator_id: string;
  pending_joins?: JoinRequestInfo[];
  turn_expires_at?: number;
  turn_timeout_seconds?: number;
}

export interface TableInfo {
  id: string;
  name: string;
  is_private: boolean;
  invite_code: string | null;
  small_blind: number;
  big_blind: number;
  min_buy_in: number;
  max_buy_in: number;
  max_players: number;
  current_players: number;
  status: string;
  variant: string;
}

export interface HandResultInfo {
  player_id: string;
  hand_rank: string;
  cards: Card[];
  winnings: number;
}

export interface LeaderboardEntry {
  rank: number;
  display_name: string;
  avatar_url: string | null;
  total_winnings: number;
  total_hands_played: number;
}

// ─── WebSocket Message Types ───

export type ServerMessage =
  | { type: "game_state" } & GameState
  | { type: "cards_dealt"; player_id: string; cards: Card[]; phase: string }
  | { type: "community_cards"; cards: Card[]; phase: string }
  | { type: "player_action"; player_id: string; action: string; amount: number }
  | { type: "hand_result"; results: HandResultInfo[]; pot_total: number; server_seed: string | null; server_seed_hash: string | null }
  | { type: "player_joined"; player_id: string; display_name: string; seat: number; chips: number }
  | { type: "player_left"; player_id: string }
  | { type: "join_requested"; table_id: string; player_id: string; display_name: string; buy_in: number }
  | { type: "chat"; player_id: string; display_name: string; message: string }
  | { type: "error"; message: string }
  | { type: "pong" };

export type ClientMessage =
  | { type: "join_table"; table_id: string; buy_in: number }
  | { type: "join_request"; table_id: string; buy_in: number; display_name: string }
  | { type: "join_respond"; table_id: string; player_id: string; accepted: boolean; buy_in: number }
  | { type: "leave_table"; table_id: string }
  | { type: "action"; table_id: string; action: string; amount?: number }
  | { type: "start_game"; table_id: string }
  | { type: "set_seed"; table_id: string; seed: string }
  | { type: "chat"; table_id: string; message: string }
  | { type: "observe_table"; table_id: string }
  | { type: "ping" };
