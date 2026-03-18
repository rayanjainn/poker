use std::sync::Arc;

use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};

use crate::auth::jwt::Claims;
use crate::db::queries;
use crate::errors::AppError;
use crate::AppState;

#[derive(Serialize)]
pub struct ProfileResponse {
    pub id: uuid::Uuid,
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub balance: i64,
    pub total_winnings: i64,
    pub total_hands_played: i32,
    pub is_guest: bool,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct UpdateProfileRequest {
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
}

pub async fn get_profile(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ProfileResponse>, AppError> {
    let user = queries::get_user_by_id(&state.db, claims.sub)
        .await?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    Ok(Json(ProfileResponse {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        balance: user.balance,
        total_winnings: user.total_winnings,
        total_hands_played: user.total_hands_played,
        is_guest: user.is_guest,
    }))
}

pub async fn update_profile(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(_req): Json<UpdateProfileRequest>,
) -> Result<Json<ProfileResponse>, AppError> {
    // For now, just return the current profile
    // TODO: Implement update logic
    get_profile(State(state), Extension(claims)).await
}
