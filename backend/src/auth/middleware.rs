use std::sync::Arc;

use axum::{
    extract::{Request, State},
    http::{self, StatusCode},
    middleware::Next,
    response::Response,
};

use crate::auth::jwt;
use crate::AppState;

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = req
        .headers()
        .get(http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));

    match auth_header {
        Some(token) => {
            match jwt::verify_token(token, &state.jwt_secret) {
                Ok(claims) => {
                    // Fast path: if the user ID is in claims, verify they actually exist in DB
                    match crate::db::queries::get_user_by_id(&state.db, claims.sub).await {
                        Ok(Some(_)) => {
                            req.extensions_mut().insert(claims);
                            Ok(next.run(req).await)
                        }
                        Ok(None) => Err(StatusCode::UNAUTHORIZED), // User deleted or DB remade
                        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
                    }
                }
                Err(_) => Err(StatusCode::UNAUTHORIZED),
            }
        }
        None => Err(StatusCode::UNAUTHORIZED),
    }
}
