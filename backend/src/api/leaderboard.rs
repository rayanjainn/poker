use std::sync::Arc;

use axum::{extract::State, Json};
use serde::Serialize;

use crate::db::queries;
use crate::errors::AppError;
use crate::AppState;

#[derive(Serialize)]
pub struct LeaderboardResponse {
    pub entries: Vec<LeaderboardEntryResponse>,
}

#[derive(Serialize)]
pub struct LeaderboardEntryResponse {
    pub rank: i64,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub total_winnings: i64,
    pub total_hands_played: i32,
}

pub async fn get_leaderboard(
    State(state): State<Arc<AppState>>,
) -> Result<Json<LeaderboardResponse>, AppError> {
    let entries = queries::get_leaderboard(&state.db, 100).await?;

    Ok(Json(LeaderboardResponse {
        entries: entries
            .into_iter()
            .map(|e| LeaderboardEntryResponse {
                rank: e.rank.unwrap_or(0),
                display_name: e.display_name,
                avatar_url: e.avatar_url,
                total_winnings: e.total_winnings,
                total_hands_played: e.total_hands_played,
            })
            .collect(),
    }))
}
