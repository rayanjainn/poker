use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::engine::deck::Card;

/// Messages sent from client to server
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    #[serde(rename = "join_table")]
    JoinTable {
        table_id: Uuid,
        buy_in: i64,
    },
    #[serde(rename = "join_request")]
    JoinRequest {
        table_id: Uuid,
        buy_in: i64,
        display_name: String,
    },
    #[serde(rename = "join_respond")]
    JoinRespond {
        table_id: Uuid,
        player_id: Uuid,
        accepted: bool,
        buy_in: i64,
    },
    #[serde(rename = "leave_table")]
    LeaveTable {
        table_id: Uuid,
    },
    #[serde(rename = "action")]
    Action {
        table_id: Uuid,
        action: String,
        amount: Option<i64>,
    },
    #[serde(rename = "start_game")]
    StartGame {
        table_id: Uuid,
    },
    #[serde(rename = "set_seed")]
    SetSeed {
        table_id: Uuid,
        seed: String,
    },
    #[serde(rename = "chat")]
    Chat {
        table_id: Uuid,
        message: String,
    },
    #[serde(rename = "observe_table")]
    ObserveTable {
        table_id: Uuid,
    },
    #[serde(rename = "ping")]
    Ping,
}

/// Messages sent from server to client
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "game_state")]
    GameState(GameStateMsg),

    #[serde(rename = "cards_dealt")]
    CardsDealt {
        player_id: Uuid,
        cards: Vec<Card>,
        phase: String,
    },

    #[serde(rename = "community_cards")]
    CommunityCards {
        cards: Vec<Card>,
        phase: String,
    },

    #[serde(rename = "player_action")]
    PlayerAction {
        player_id: Uuid,
        action: String,
        amount: i64,
    },

    #[serde(rename = "hand_result")]
    HandResult {
        results: Vec<HandResultInfo>,
        pot_total: i64,
        server_seed: Option<String>,
        server_seed_hash: Option<String>,
    },

    #[serde(rename = "player_joined")]
    PlayerJoined {
        player_id: Uuid,
        display_name: String,
        seat: usize,
        chips: i64,
    },

    #[serde(rename = "join_requested")]
    JoinRequested {
        table_id: Uuid,
        player_id: Uuid,
        display_name: String,
        buy_in: i64,
    },

    #[serde(rename = "player_left")]
    PlayerLeft {
        player_id: Uuid,
    },

    #[serde(rename = "chat")]
    Chat {
        player_id: Uuid,
        display_name: String,
        message: String,
    },

    #[serde(rename = "error")]
    Error {
        message: String,
    },

    #[serde(rename = "pong")]
    Pong,
}

#[derive(Debug, Clone, Serialize)]
pub struct GameStateMsg {
    pub table_id: Uuid,
    pub status: String,
    pub phase: Option<String>,
    pub community_cards: Vec<Card>,
    pub pot: i64,
    pub current_bet: i64,
    pub action_on: Option<Uuid>,
    pub dealer_seat: Option<usize>,
    pub players: Vec<PlayerInfo>,
    pub small_blind: i64,
    pub big_blind: i64,
    pub hand_number: Option<i64>,
    pub server_seed_hash: Option<String>,
    pub creator_id: Uuid,
    pub pending_joins: Vec<JoinRequestInfo>,
    pub turn_expires_at: Option<i64>,
    pub turn_timeout_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinRequestInfo {
    pub player_id: Uuid,
    pub display_name: String,
    pub buy_in: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlayerInfo {
    pub id: Uuid,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub chips: i64,
    pub seat: usize,
    pub is_folded: bool,
    pub is_all_in: bool,
    pub is_sitting_out: bool,
    pub current_bet: i64,
    pub is_dealer: bool,
    pub current_hand_rank: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HandResultInfo {
    pub player_id: Uuid,
    pub hand_rank: String,
    pub cards: Vec<Card>,
    pub winnings: i64,
}
