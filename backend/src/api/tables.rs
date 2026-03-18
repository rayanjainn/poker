use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::{models::TableRecord, queries};
use crate::errors::AppError;
use crate::fairness;
use crate::AppState;

#[derive(Deserialize)]
pub struct CreateTableRequest {
    pub name: String,
    pub is_private: bool,
    pub small_blind: i64,
    pub big_blind: i64,
    pub min_buy_in: i64,
    pub max_buy_in: i64,
    pub max_players: i32,
    pub variant: Option<String>,
}

#[derive(Serialize)]
pub struct TableResponse {
    pub id: Uuid,
    pub name: String,
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
}

pub async fn create_table(
    State(state): State<Arc<AppState>>,
    axum::extract::Extension(claims): axum::extract::Extension<crate::auth::jwt::Claims>,
    Json(req): Json<CreateTableRequest>,
) -> Result<Json<TableResponse>, AppError> {
    // Allow guests to create tables per requirement
    // if claims.is_guest {
    //     return Err(AppError::Auth("Guest users cannot create tables".to_string()));
    // }

    let table_id = Uuid::new_v4();
    let invite_code = if req.is_private {
        Some(format!("{}", &Uuid::new_v4().to_string()[..8]))
    } else {
        None
    };

    let creator_id = claims.sub;

    let record = TableRecord {
        id: table_id,
        name: req.name.clone(),
        created_by: creator_id,
        is_private: req.is_private,
        invite_code: invite_code.clone(),
        small_blind: req.small_blind,
        big_blind: req.big_blind,
        min_buy_in: req.min_buy_in,
        max_buy_in: req.max_buy_in,
        max_players: req.max_players,
        current_players: 0,
        status: "waiting".to_string(),
        variant: req.variant.clone().unwrap_or_else(|| "texas_holdem".to_string()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    // Save to database
    let saved = queries::create_table_record(&state.db, &record).await?;

    // Initialize in engine
    state.table_manager.create_table(
        table_id,
        creator_id,
        req.small_blind,
        req.big_blind,
        req.min_buy_in,
        req.max_buy_in,
        req.max_players as usize,
    );

    Ok(Json(TableResponse {
        id: saved.id,
        name: saved.name,
        is_private: saved.is_private,
        invite_code: saved.invite_code,
        small_blind: saved.small_blind,
        big_blind: saved.big_blind,
        min_buy_in: saved.min_buy_in,
        max_buy_in: saved.max_buy_in,
        max_players: saved.max_players,
        current_players: saved.current_players,
        status: saved.status,
        variant: saved.variant,
    }))
}

pub async fn list_tables(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TableResponse>>, AppError> {
    let tables = queries::list_tables(&state.db).await?;

    Ok(Json(
        tables
            .into_iter()
            .map(|t| TableResponse {
                id: t.id,
                name: t.name,
                is_private: t.is_private,
                invite_code: t.invite_code,
                small_blind: t.small_blind,
                big_blind: t.big_blind,
                min_buy_in: t.min_buy_in,
                max_buy_in: t.max_buy_in,
                max_players: t.max_players,
                current_players: t.current_players,
                status: t.status,
                variant: t.variant,
            })
            .collect(),
    ))
}

pub async fn get_table(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<TableResponse>, AppError> {
    let table = queries::get_table_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound("Table not found".to_string()))?;

    Ok(Json(TableResponse {
        id: table.id,
        name: table.name,
        is_private: table.is_private,
        invite_code: table.invite_code,
        small_blind: table.small_blind,
        big_blind: table.big_blind,
        min_buy_in: table.min_buy_in,
        max_buy_in: table.max_buy_in,
        max_players: table.max_players,
        current_players: table.current_players,
        status: table.status,
        variant: table.variant,
    }))
}

pub async fn get_hand_history(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let hand = queries::get_hand_history(&state.db, id)
        .await?
        .ok_or(AppError::NotFound("Hand not found".to_string()))?;

    Ok(Json(serde_json::json!({
        "id": hand.id,
        "table_id": hand.table_id,
        "hand_number": hand.hand_number,
        "players": hand.players,
        "community_cards": hand.community_cards,
        "actions": hand.actions,
        "pot_total": hand.pot_total,
        "winners": hand.winners,
        "server_seed_hash": hand.server_seed_hash,
        "server_seed": hand.server_seed,
    })))
}

pub async fn verify_fairness(
    State(state): State<Arc<AppState>>,
    Path(hand_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let hand = queries::get_hand_history(&state.db, hand_id)
        .await?
        .ok_or(AppError::NotFound("Hand not found".to_string()))?;

    let server_seed = hand
        .server_seed
        .ok_or(AppError::BadRequest("Server seed not yet revealed".to_string()))?;

    let is_valid = fairness::shuffle::verify_seed(&server_seed, &hand.server_seed_hash);

    Ok(Json(serde_json::json!({
        "hand_id": hand_id,
        "server_seed": server_seed,
        "server_seed_hash": hand.server_seed_hash,
        "is_valid": is_valid,
        "message": if is_valid { "The shuffle was provably fair" } else { "VERIFICATION FAILED" },
    })))
}
