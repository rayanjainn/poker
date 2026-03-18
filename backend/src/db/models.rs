#![allow(dead_code)]
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub password_hash: Option<String>,
    pub is_guest: bool,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub balance: i64,
    pub total_winnings: i64,
    pub total_hands_played: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TableRecord {
    pub id: Uuid,
    pub name: String,
    pub created_by: Uuid,
    pub is_private: bool,
    pub invite_code: Option<String>,
    pub small_blind: i64,
    pub big_blind: i64,
    pub min_buy_in: i64,
    pub max_buy_in: i64,
    pub max_players: i32,
    pub current_players: i32,
    pub status: String,
    pub variant: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HandHistory {
    pub id: Uuid,
    pub table_id: Uuid,
    pub hand_number: i64,
    pub players: serde_json::Value,
    pub community_cards: serde_json::Value,
    pub actions: serde_json::Value,
    pub pot_total: i64,
    pub winners: serde_json::Value,
    pub server_seed_hash: String,
    pub server_seed: Option<String>,
    pub player_seeds: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Transaction {
    pub id: Uuid,
    pub user_id: Uuid,
    pub table_id: Option<Uuid>,
    pub hand_id: Option<Uuid>,
    pub tx_type: String,
    pub amount: i64,
    pub balance_after: i64,
    pub description: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LeaderboardEntry {
    pub user_id: Uuid,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub total_winnings: i64,
    pub total_hands_played: i32,
    pub rank: Option<i64>,
}
