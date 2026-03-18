use std::sync::Arc;

use argon2::{self, Argon2, PasswordHasher, PasswordVerifier, password_hash::{SaltString, rand_core::OsRng, PasswordHash}};
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::jwt;
use crate::db::queries;
use crate::errors::AppError;
use crate::AppState;

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub display_name: Option<String>,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub balance: i64,
    pub is_guest: bool,
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    // Check if username exists
    if let Some(_) = queries::get_user_by_username(&state.db, &req.username).await? {
        return Err(AppError::Conflict("Username already taken".to_string()));
    }

    // Hash password
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("Password hashing failed: {}", e)))?
        .to_string();

    let display_name = req.display_name.unwrap_or_else(|| req.username.clone());

    let user = queries::create_user(
        &state.db,
        &req.username,
        Some(&req.email),
        Some(&password_hash),
        &display_name,
        false,
    )
    .await?;

    let token = jwt::create_token(user.id, &user.username, false, &state.jwt_secret)?;

    Ok(Json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            balance: user.balance,
            is_guest: false,
        },
    }))
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    let user = queries::get_user_by_username(&state.db, &req.username)
        .await?
        .ok_or(AppError::Auth("Invalid credentials".to_string()))?;

    let stored_hash = user
        .password_hash
        .as_ref()
        .ok_or(AppError::Auth("Invalid credentials".to_string()))?;

    let parsed_hash = PasswordHash::new(stored_hash)
        .map_err(|_| AppError::Auth("Invalid credentials".to_string()))?;

    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Auth("Invalid credentials".to_string()))?;

    let token = jwt::create_token(user.id, &user.username, user.is_guest, &state.jwt_secret)?;

    Ok(Json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            balance: user.balance,
            is_guest: user.is_guest,
        },
    }))
}

pub async fn guest_login(
    State(state): State<Arc<AppState>>,
) -> Result<Json<AuthResponse>, AppError> {
    let guest_id = Uuid::new_v4();
    let username = format!("guest_{}", &guest_id.to_string()[..8]);
    let display_name = format!("Guest {}", &guest_id.to_string()[..4].to_uppercase());

    let user = queries::create_user(
        &state.db,
        &username,
        None,
        None,
        &display_name,
        true,
    )
    .await?;

    let token = jwt::create_token(user.id, &user.username, true, &state.jwt_secret)?;

    Ok(Json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            balance: user.balance,
            is_guest: true,
        },
    }))
}
