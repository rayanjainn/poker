use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade, Query,
    },
    response::Response,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::broadcast;
use uuid::Uuid;

use super::messages::{ClientMessage, ServerMessage};
use crate::auth::jwt;
use crate::engine::betting::PlayerAction;
use crate::AppState;

#[derive(Deserialize)]
pub struct WsQuery {
    token: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    Query(query): Query<WsQuery>,
) -> Response {
    // Authenticate via token in query params
    let claims = match jwt::verify_token(&query.token, &state.jwt_secret) {
        Ok(c) => c,
        Err(_) => {
            return Response::builder()
                .status(401)
                .body("".into())
                .unwrap();
        }
    };

    ws.on_upgrade(move |socket| handle_socket(socket, state, claims))
}

async fn handle_socket(
    socket: WebSocket,
    state: Arc<AppState>,
    claims: jwt::Claims,
) {
    let (mut sender, mut receiver) = socket.split();
    let player_id = claims.sub;
    let player_name = claims.username.clone();

    tracing::info!("WebSocket connected: {} ({})", player_name, player_id);

    // Track which table the player is at
    let current_table: Arc<tokio::sync::Mutex<Option<Uuid>>> = Arc::new(tokio::sync::Mutex::new(None));
    let current_table_clone = current_table.clone();

    // Channel for sending messages to this client
    let (tx, mut rx) = tokio::sync::mpsc::channel::<ServerMessage>(64);

    // Task to forward messages to WebSocket
    let send_task = tokio::spawn(async move {
        let player_id_inner = player_id; // Capture for logging
        while let Some(msg) = rx.recv().await {
            let json = serde_json::to_string(&msg).unwrap();
            if let Err(e) = sender.send(Message::Text(json.into())).await {
                tracing::error!("Error sending to client {}: {}", player_id_inner, e);
                break;
            }
        }
    });

    // Spawn broadcast listener (listens for table broadcasts)
    let broadcast_tx = tx.clone();
    let state_clone = state.clone();
    let broadcast_task = tokio::spawn(async move {
        let mut current_rx: Option<broadcast::Receiver<ServerMessage>> = None;
        let mut subscribed_tid: Option<Uuid> = None;

        loop {
            // Check if we have an active table subscription
            let table_id = {
                let lock = current_table_clone.lock().await;
                *lock
            };

            if table_id != subscribed_tid {
                subscribed_tid = table_id;
                if let Some(tid) = table_id {
                    current_rx = state_clone.table_manager.subscribe(&tid);
                } else {
                    current_rx = None;
                }
            }

            if let Some(ref mut rx) = current_rx {
                // Use a short timeout to check for table switches frequently even if no broadcasts arrive
                match tokio::time::timeout(tokio::time::Duration::from_millis(100), rx.recv()).await {
                    Ok(Ok(msg)) => {
                        // Filter private messages (cards) to only send to correct player
                        match &msg {
                            ServerMessage::CardsDealt { player_id: pid, .. } => {
                                if *pid == player_id {
                                    let _ = broadcast_tx.send(msg).await;
                                }
                            }
                            ServerMessage::JoinRequested { .. } => {
                                tracing::info!("Client {} receiving JoinRequested broadcast", player_id);
                                let _ = broadcast_tx.send(msg).await;
                            }
                            _ => {
                                let _ = broadcast_tx.send(msg).await;
                            }
                        }
                    }
                    Ok(Err(broadcast::error::RecvError::Lagged(n))) => {
                        tracing::warn!("Client {} lagged {} messages", player_id, n);
                    }
                    Ok(Err(broadcast::error::RecvError::Closed)) => {
                        current_rx = None;
                    }
                    Err(_) => {
                        // Timeout - just loop and check if tid changed
                    }
                }
            } else {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        }
    });

    // Main receive loop
    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            let text_str: &str = &text;
            match serde_json::from_str::<ClientMessage>(text_str) {
                Ok(client_msg) => {
                    let response = handle_client_message(
                        &state,
                        player_id,
                        &player_name,
                        &client_msg,
                        &current_table,
                    )
                    .await;

                    if let Some(msg) = response {
                        let _ = tx.send(msg).await;
                    }
                }
                Err(e) => {
                    let _ = tx
                        .send(ServerMessage::Error {
                            message: format!("Invalid message: {}", e),
                        })
                        .await;
                }
            }
        }
    }

    // Cleanup: remove player from table on disconnect
    {
        let table_id = current_table.lock().await;
        if let Some(tid) = *table_id {
            if let Some(table_arc) = state.table_manager.ensure_table(&tid).await.ok().flatten() {
                let mut table = table_arc.lock().await;
                
                // Track if creator left even if not seated
                let was_creator = table.creator_id == player_id;

                if let Some(player) = table.remove_player(player_id) {
                    // Return chips to balance on disconnect
                    let _ = crate::db::queries::update_user_balance(&state.db, player_id, player.chips).await;
                }

                // If the creator left (seated or observer), promote someone else
                if was_creator && !table.players.is_empty() {
                    table.creator_id = table.players[0].id;
                }

                // Sync new creator to DB if it changed
                let _ = crate::db::queries::update_table_creator(&state.db, tid, table.creator_id).await;

                // Update player count based on seated players
                let count = table.players.len() as i32;
                let _ = crate::db::queries::update_table_player_count(&state.db, tid, count).await;

                // Broadcast updated state
                if let Some(broadcaster) = state.table_manager.get_broadcaster(&tid) {
                    let messages = table.get_messages_after_leave();
                    for m in messages {
                        let _ = broadcaster.send(m);
                    }
                    let _ = broadcaster.send(ServerMessage::PlayerLeft { player_id });
                }
            }
        }
    }

    broadcast_task.abort();
    send_task.abort();

    tracing::info!("WebSocket disconnected: {} ({})", player_name, player_id);
}

async fn handle_client_message(
    state: &Arc<AppState>,
    player_id: Uuid,
    player_name: &str,
    msg: &ClientMessage,
    current_table: &Arc<tokio::sync::Mutex<Option<Uuid>>>,
) -> Option<ServerMessage> {
    tracing::info!("Incoming ClientMessage: {:?}", msg);
    match msg {
        ClientMessage::JoinRequest { table_id, buy_in, display_name } => {
            // Update user's display name in DB if requested
            let _ = crate::db::queries::update_user_display_name(&state.db, player_id, display_name.as_str()).await;

            // Get user info
            let user = match crate::db::queries::get_user_by_id(&state.db, player_id).await {
                Ok(Some(u)) => u,
                _ => {
                    tracing::error!("JOIN_REQUEST: User not found in DB for player_id: {}", player_id);
                    return Some(ServerMessage::Error { message: format!("User not found (ID: {})", player_id) });
                }
            };

            if user.balance < *buy_in {
                return Some(ServerMessage::Error { message: "Insufficient balance".to_string() });
            }

            // Verify table and check admin
            let table_arc = match state.table_manager.ensure_table(table_id).await {
                Ok(Some(t)) => t,
                _ => return Some(ServerMessage::Error { message: "Table not found".to_string() }),
            };

            tracing::info!("JOIN_REQUEST: Processing request from player {} for table {} with buy-in {}", player_id, table_id, buy_in);

            let mut table = table_arc.lock().await;

            // If the player is the creator, join them directly
            let is_creator = player_id == table.creator_id;
            tracing::info!("JOIN_REQUEST: Comparing {} with creator {} (Matches: {})", 
                player_id, table.creator_id, is_creator);

            if is_creator {
                tracing::info!("JOIN_REQUEST: Creator {} joining table {} directly", player_id, table_id);
                match table.add_player(
                    player_id,
                    display_name.clone(),
                    user.avatar_url.clone(),
                    *buy_in,
                ) {
                    Ok(seat) => {
                        let _ = crate::db::queries::update_user_balance(&state.db, player_id, -*buy_in).await;
                        let count = table.players.len() as i32;
                        let _ = crate::db::queries::update_table_player_count(&state.db, *table_id, count).await;
                        let msg = table.build_game_state_message();

                        if let Some(broadcaster) = state.table_manager.get_broadcaster(table_id) {
                            let _ = broadcaster.send(ServerMessage::PlayerJoined {
                                player_id,
                                display_name: display_name.clone(),
                                seat,
                                chips: *buy_in,
                            });
                            let _ = broadcaster.send(msg.clone());
                        }

                        return Some(msg);
                    }
                    Err(e) => {
                        tracing::warn!("JOIN_REQUEST: Failed to add creator directly: {}", e);
                        // If they are already in the hand (e.g. they refreshed), just return current state
                        if e.contains("already at table") {
                            return Some(table.build_game_state_message());
                        }
                        return Some(ServerMessage::Error { message: e });
                    }
                }
            }

            tracing::info!("JOIN_REQUEST: Player {} is NOT creator of table {} (Creator: {})", player_id, table_id, table.creator_id);
            
            // Store the request persistently
            let req = crate::ws::messages::JoinRequestInfo {
                player_id,
                display_name: display_name.clone(),
                buy_in: *buy_in,
            };
            
            // Avoid duplicates in pending_joins
            table.pending_joins.retain(|r| r.player_id != player_id);
            table.pending_joins.push(req);
            
            tracing::info!("JOIN_REQUEST: Added player {} to pending_joins. Total pending: {}", player_id, table.pending_joins.len());

            // Broadcast update to the table
            if let Some(broadcaster) = state.table_manager.get_broadcaster(table_id) {
                tracing::info!("JOIN_REQUEST: Broadcasting updates to table {}", table_id);
                // Send specific message for toast/immediate notification
                let _ = broadcaster.send(ServerMessage::JoinRequested {
                    table_id: *table_id,
                    player_id,
                    display_name: display_name.clone(),
                    buy_in: *buy_in,
                });
                
                let state_msg = table.build_game_state_message();
                tracing::info!("JOIN_REQUEST: GameState message built, pending_joins size in msg: {}", 
                    if let ServerMessage::GameState(ref s) = state_msg { s.pending_joins.len() } else { 0 });
                
                // Send updated game state to refresh the list for the admin
                let _ = broadcaster.send(state_msg);
            } else {
                tracing::warn!("JOIN_REQUEST: No broadcaster found for table {} during JoinRequest", table_id);
                return Some(ServerMessage::Error { message: "Table channel not found".to_string() });
            }

            None
        }

        ClientMessage::JoinRespond { table_id, player_id: target_player_id, accepted, buy_in } => {
            let table_arc = match state.table_manager.ensure_table(table_id).await {
                Ok(Some(t)) => t,
                _ => return Some(ServerMessage::Error { message: "Table not found".to_string() }),
            };

            // The target player must have enough balance
            let user = match crate::db::queries::get_user_by_id(&state.db, *target_player_id).await {
                Ok(Some(u)) => u,
                _ => return Some(ServerMessage::Error { message: "Target user not found".to_string() }),
            };

            if user.balance < *buy_in {
                return Some(ServerMessage::Error { message: "Target user insufficient balance".to_string() });
            }

            let mut table = table_arc.lock().await;

            // Ensure the sender is the creator
            if table.creator_id != player_id {
                return Some(ServerMessage::Error { message: "Not authorized to accept players".to_string() });
            }

            // Always remove from pending joins when responding
            table.pending_joins.retain(|r| r.player_id != *target_player_id);

            if !accepted {
                 // Broadcast the removal
                if let Some(broadcaster) = state.table_manager.get_broadcaster(table_id) {
                    let _ = broadcaster.send(table.build_game_state_message());
                }
                return None;
            }

            match table.add_player(
                *target_player_id,
                user.display_name.clone(),
                user.avatar_url.clone(),
                *buy_in,
            ) {
                Ok(seat) => {
                    // Deduct buy-in
                    let _ = crate::db::queries::update_user_balance(&state.db, *target_player_id, -*buy_in).await;

                    // Update player count
                    let count = table.players.len() as i32;
                    let _ = crate::db::queries::update_table_player_count(&state.db, *table_id, count).await;

                    if let Some(broadcaster) = state.table_manager.get_broadcaster(table_id) {
                        let _ = broadcaster.send(ServerMessage::PlayerJoined {
                            player_id: *target_player_id,
                            display_name: user.display_name,
                            seat,
                            chips: *buy_in,
                        });
                        let _ = broadcaster.send(table.build_game_state_message());
                    }

                    None
                }
                Err(e) => Some(ServerMessage::Error { message: e }),
            }
        }

        ClientMessage::JoinTable { table_id, buy_in } => {
            // Lock current_table first to avoid deadlock (C -> T ordering)
            let mut ct = current_table.lock().await;

            // Get user info
            let user = match crate::db::queries::get_user_by_id(&state.db, player_id).await {
                Ok(Some(u)) => u,
                _ => {
                    tracing::error!("JOIN_TABLE: User not found in DB for player_id: {}", player_id);
                    return Some(ServerMessage::Error {
                        message: format!("User not found (ID: {})", player_id),
                    });
                }
            };

            if user.balance < *buy_in {
                return Some(ServerMessage::Error {
                    message: "Insufficient balance".to_string(),
                });
            }

            // Get or create table
            let table = match state.table_manager.ensure_table(table_id).await {
                Ok(Some(t)) => t,
                Ok(None) => {
                    return Some(ServerMessage::Error {
                        message: "Table not found".to_string(),
                    });
                }
                Err(_) => {
                    return Some(ServerMessage::Error {
                        message: "Database error".to_string(),
                    });
                }
            };

            let mut table = table.lock().await;
            match table.add_player(
                player_id,
                user.display_name.clone(),
                user.avatar_url.clone(),
                *buy_in,
            ) {
                Ok(seat) => {
                    // Deduct buy-in from balance
                    let _ = crate::db::queries::update_user_balance(&state.db, player_id, -*buy_in).await;

                    // Update current table
                    *ct = Some(*table_id);

                    // Update player count
                    let count = table.players.len() as i32;
                    let _ = crate::db::queries::update_table_player_count(&state.db, *table_id, count).await;

                    // Broadcast join
                    if let Some(broadcaster) = state.table_manager.get_broadcaster(table_id) {
                        let _ = broadcaster.send(ServerMessage::PlayerJoined {
                            player_id,
                            display_name: user.display_name,
                            seat,
                            chips: *buy_in,
                        });
                        let _ = broadcaster.send(table.build_game_state_message());
                    }

                    Some(table.build_game_state_message())
                }
                Err(e) => Some(ServerMessage::Error { message: e }),
            }
        }

        ClientMessage::LeaveTable { table_id } => {
            let mut ct = current_table.lock().await;
            if let Some(table_arc) = state.table_manager.ensure_table(table_id).await.ok().flatten() {
                let mut table = table_arc.lock().await;
                if let Some(player) = table.remove_player(player_id) {
                    // Return chips to balance
                    let _ = crate::db::queries::update_user_balance(&state.db, player_id, player.chips).await;

                    *ct = None;

                    // Sync new creator to DB if it changed
                    let _ = crate::db::queries::update_table_creator(&state.db, *table_id, table.creator_id).await;

                    let count = table.players.len() as i32;
                    let _ = crate::db::queries::update_table_player_count(&state.db, *table_id, count).await;

                    if let Some(broadcaster) = state.table_manager.get_broadcaster(table_id) {
                        let messages = table.get_messages_after_leave();
                        for m in messages {
                            let _ = broadcaster.send(m);
                        }
                        let _ = broadcaster.send(ServerMessage::PlayerLeft { player_id });
                    }
                }
            }
            None
        }

        ClientMessage::ObserveTable { table_id } => {
            let mut ct = current_table.lock().await;
            if let Some(table_arc) = state.table_manager.ensure_table(table_id).await.ok().flatten() {
                let table = table_arc.lock().await;
                *ct = Some(*table_id);
                return Some(table.build_game_state_message());
            }
            None
        }

        ClientMessage::Action { table_id, action, amount } => {
            let player_action = match action.as_str() {
                "fold" => PlayerAction::Fold,
                "check" => PlayerAction::Check,
                "call" => PlayerAction::Call,
                "raise" => PlayerAction::Raise(amount.unwrap_or(0)),
                "all_in" => PlayerAction::AllIn,
                _ => {
                    return Some(ServerMessage::Error {
                        message: "Invalid action".to_string(),
                    });
                }
            };

            if let Some(table) = state.table_manager.ensure_table(table_id).await.ok().flatten() {
                let mut table = table.lock().await;
                match table.process_action(player_id, player_action) {
                    Ok(messages) => {
                        broadcast_messages(state, table_id, messages).await;
                        None
                    }
                    Err(e) => Some(ServerMessage::Error { message: e }),
                }
            } else {
                Some(ServerMessage::Error {
                    message: "Table not found".to_string(),
                })
            }
        }

        ClientMessage::StartGame { table_id } => {
            if let Some(table) = state.table_manager.ensure_table(table_id).await.ok().flatten() {
                let mut table = table.lock().await;
                match table.start_hand() {
                    Ok(messages) => {
                        broadcast_messages(state, table_id, messages).await;
                        None
                    }
                    Err(e) => Some(ServerMessage::Error { message: e }),
                }
            } else {
                Some(ServerMessage::Error {
                    message: "Table not found".to_string(),
                })
            }
        }

        ClientMessage::SetSeed { table_id, seed } => {
            if let Some(table) = state.table_manager.ensure_table(table_id).await.ok().flatten() {
                let mut table = table.lock().await;
                table.set_player_seed(player_id, seed.clone());
                None
            } else {
                Some(ServerMessage::Error {
                    message: "Table not found".to_string(),
                })
            }
        }

        ClientMessage::Chat { table_id, message } => {
            if let Some(broadcaster) = state.table_manager.get_broadcaster(table_id) {
                let _ = broadcaster.send(ServerMessage::Chat {
                    player_id,
                    display_name: player_name.to_string(),
                    message: message.clone(),
                });
            }
            None
        }

        ClientMessage::Ping => Some(ServerMessage::Pong),
    }
}
async fn broadcast_messages(
    state: &Arc<AppState>,
    table_id: &Uuid,
    messages: Vec<ServerMessage>,
) {
    if let Some(broadcaster) = state.table_manager.get_broadcaster(table_id) {
        for msg in messages {
            // Handle DB updates for hand results
            if let ServerMessage::HandResult { results, .. } = &msg {
                let db = state.db.clone();
                let table_id = *table_id;
                let results = results.clone();

                tokio::spawn(async move {
                    for res in results {
                        // Update player chips in DB (they are already updated in engine state)
                        // This ensures that if they leave, the balance is correct.
                        // However, we should also track total winnings.
                        let _ = crate::db::queries::update_user_stats(
                            &db,
                            res.player_id,
                            res.winnings,
                            1,
                        )
                        .await;
                    }
                    // TODO: save_hand_history
                });
            }
            let _ = broadcaster.send(msg);
        }
    }
}
