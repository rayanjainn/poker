use std::sync::Arc;

mod api;
mod auth;
mod config;
mod db;
mod engine;
mod errors;
mod fairness;
mod security;
mod ws;

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub struct AppState {
    pub db: sqlx::PgPool,
    pub jwt_secret: String,
    pub table_manager: engine::TableManager,
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()  
        .with(tracing_subscriber::EnvFilter::try_from_default_env()     
            .unwrap_or_else(|_| "poker_backend=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/poker".to_string());
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "super-secret-jwt-key-change-in-production".to_string());

    // Connect to database with a longer timeout for remote cloud connections
    let db = sqlx::postgres::PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(std::time::Duration::from_secs(45)) // Longer timeout for remote DBs
        .connect(&database_url)
        .await
        .expect("Failed to connect to database (PoolTimedOut)");

    tracing::info!("Database connected");

    let state = Arc::new(AppState {
        db: db.clone(),
        jwt_secret,
        table_manager: engine::TableManager::new(db.clone()),
    });

    // Load existing tables into memory
    let _ = state.table_manager.initialize_from_db().await;

    // Start background timeout checker
    let manager_clone = state.table_manager.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));
        loop {
            interval.tick().await;
            manager_clone.tick().await;
        }
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_private_network(true);

    let protected_routes = Router::new()
        .route("/api/users/me", get(api::users::get_profile).post(api::users::update_profile))
        .route("/api/tables", post(api::tables::create_table))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth::middleware::auth_middleware,
        ));

    let app = Router::new()
        .merge(protected_routes)
        // Auth routes
        .route("/api/auth/register", post(api::auth::register))
        .route("/api/auth/login", post(api::auth::login))
        .route("/api/auth/guest", post(api::auth::guest_login))
        // Table routes (public)
        .route("/api/tables", get(api::tables::list_tables))
        .route("/api/tables/{id}", get(api::tables::get_table))
        // Leaderboard
        .route("/api/leaderboard", get(api::leaderboard::get_leaderboard))
        // Hand history
        .route("/api/hands/{id}", get(api::tables::get_hand_history))
        // Fairness verification
        .route("/api/fairness/{hand_id}", get(api::tables::verify_fairness))
        // WebSocket
        .route("/ws", get(ws::handler::ws_handler))
        // Health check
        .route("/api/health", get(|| async { "OK" }))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    tracing::info!("Server starting on http://0.0.0.0:8080");
    axum::serve(listener, app).await.unwrap();
}
