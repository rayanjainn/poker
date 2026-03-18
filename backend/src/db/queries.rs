#![allow(dead_code)]

use sqlx::PgPool;
use uuid::Uuid;

use super::models::*;
use crate::errors::AppError;

// ─── Users ──────────────────────────────────────────────────────────────

pub async fn create_user(
    pool: &PgPool,
    username: &str,
    email: Option<&str>,
    password_hash: Option<&str>,
    display_name: &str,
    is_guest: bool,
) -> Result<User, AppError> {
    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, username, email, password_hash, is_guest, display_name, balance)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(username)
    .bind(email)
    .bind(password_hash)
    .bind(is_guest)
    .bind(display_name)
    .bind(10000i64) // Starting balance
    .fetch_one(pool)
    .await?;

    Ok(user)
}

pub async fn get_user_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>, AppError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(user)
}

pub async fn get_user_by_username(pool: &PgPool, username: &str) -> Result<Option<User>, AppError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1")
        .bind(username)
        .fetch_optional(pool)
        .await?;
    Ok(user)
}

pub async fn update_user_balance(
    pool: &PgPool,
    user_id: Uuid,
    delta: i64,
) -> Result<i64, AppError> {
    let row = sqlx::query_scalar::<_, i64>(
        "UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING balance",
    )
    .bind(delta)
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn update_user_display_name(
    pool: &PgPool,
    user_id: Uuid,
    display_name: &str,
) -> Result<(), AppError> {
    sqlx::query("UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2")
        .bind(display_name)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_user_stats(
    pool: &PgPool,
    user_id: Uuid,
    winnings_delta: i64,
    hands_delta: i32,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE users SET total_winnings = total_winnings + $1, total_hands_played = total_hands_played + $2, updated_at = NOW() WHERE id = $3",
    )
    .bind(winnings_delta)
    .bind(hands_delta)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

// ─── Tables ─────────────────────────────────────────────────────────────

pub async fn create_table_record(
    pool: &PgPool,
    table: &TableRecord,
) -> Result<TableRecord, AppError> {
    let record = sqlx::query_as::<_, TableRecord>(
        r#"
        INSERT INTO tables (id, name, created_by, is_private, invite_code, small_blind, big_blind, min_buy_in, max_buy_in, max_players, current_players, status, variant)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
        "#,
    )
    .bind(table.id)
    .bind(&table.name)
    .bind(table.created_by)
    .bind(table.is_private)
    .bind(&table.invite_code)
    .bind(table.small_blind)
    .bind(table.big_blind)
    .bind(table.min_buy_in)
    .bind(table.max_buy_in)
    .bind(table.max_players)
    .bind(table.current_players)
    .bind(&table.status)
    .bind(&table.variant)
    .fetch_one(pool)
    .await?;
    Ok(record)
}

pub async fn list_tables(pool: &PgPool) -> Result<Vec<TableRecord>, AppError> {
    let tables = sqlx::query_as::<_, TableRecord>(
        "SELECT * FROM tables WHERE status != 'closed' ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(tables)
}

pub async fn get_table_by_id(pool: &PgPool, id: Uuid) -> Result<Option<TableRecord>, AppError> {
    let table = sqlx::query_as::<_, TableRecord>("SELECT * FROM tables WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(table)
}

pub async fn update_table_player_count(
    pool: &PgPool,
    table_id: Uuid,
    count: i32,
) -> Result<(), AppError> {
    sqlx::query("UPDATE tables SET current_players = $1, updated_at = NOW() WHERE id = $2")
        .bind(count)
        .bind(table_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_table_creator(
    pool: &PgPool,
    table_id: Uuid,
    creator_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query("UPDATE tables SET created_by = $1, updated_at = NOW() WHERE id = $2")
        .bind(creator_id)
        .bind(table_id)
        .execute(pool)
        .await?;
    Ok(())
}

// ─── Hand History ───────────────────────────────────────────────────────

pub async fn save_hand_history(
    pool: &PgPool,
    hand: &HandHistory,
) -> Result<(), AppError> {
    sqlx::query(
        r#"
        INSERT INTO hand_histories (id, table_id, hand_number, players, community_cards, actions, pot_total, winners, server_seed_hash, server_seed, player_seeds)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        "#,
    )
    .bind(hand.id)
    .bind(hand.table_id)
    .bind(hand.hand_number)
    .bind(&hand.players)
    .bind(&hand.community_cards)
    .bind(&hand.actions)
    .bind(hand.pot_total)
    .bind(&hand.winners)
    .bind(&hand.server_seed_hash)
    .bind(&hand.server_seed)
    .bind(&hand.player_seeds)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_hand_history(pool: &PgPool, hand_id: Uuid) -> Result<Option<HandHistory>, AppError> {
    let hand = sqlx::query_as::<_, HandHistory>(
        "SELECT * FROM hand_histories WHERE id = $1",
    )
    .bind(hand_id)
    .fetch_optional(pool)
    .await?;
    Ok(hand)
}

pub async fn get_table_hand_histories(
    pool: &PgPool,
    table_id: Uuid,
    limit: i64,
) -> Result<Vec<HandHistory>, AppError> {
    let hands = sqlx::query_as::<_, HandHistory>(
        "SELECT * FROM hand_histories WHERE table_id = $1 ORDER BY created_at DESC LIMIT $2",
    )
    .bind(table_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(hands)
}

// ─── Transactions ───────────────────────────────────────────────────────

pub async fn create_transaction(
    pool: &PgPool,
    tx: &Transaction,
) -> Result<(), AppError> {
    sqlx::query(
        r#"
        INSERT INTO transactions (id, user_id, table_id, hand_id, tx_type, amount, balance_after, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(tx.id)
    .bind(tx.user_id)
    .bind(tx.table_id)
    .bind(tx.hand_id)
    .bind(&tx.tx_type)
    .bind(tx.amount)
    .bind(tx.balance_after)
    .bind(&tx.description)
    .execute(pool)
    .await?;
    Ok(())
}

// ─── Leaderboard ────────────────────────────────────────────────────────

pub async fn get_leaderboard(pool: &PgPool, limit: i64) -> Result<Vec<LeaderboardEntry>, AppError> {
    let entries = sqlx::query_as::<_, LeaderboardEntry>(
        r#"
        SELECT id as user_id, display_name, avatar_url, total_winnings, total_hands_played,
               RANK() OVER (ORDER BY total_winnings DESC) as rank
        FROM users
        WHERE is_guest = false AND total_hands_played > 0
        ORDER BY total_winnings DESC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(entries)
}
