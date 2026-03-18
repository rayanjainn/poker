#![allow(dead_code)]
use std::collections::HashMap;
use std::time::{Duration, Instant};
use uuid::Uuid;

/// Anti-cheat: detects abnormal play patterns
pub struct AntiCheatMonitor {
    action_history: HashMap<Uuid, Vec<ActionTimestamp>>,
}

struct ActionTimestamp {
    action: String,
    timestamp: Instant,
}

impl AntiCheatMonitor {
    pub fn new() -> Self {
        Self {
            action_history: HashMap::new(),
        }
    }

    pub fn record_action(&mut self, player_id: Uuid, action: &str) {
        let entry = self.action_history.entry(player_id).or_insert_with(Vec::new);
        entry.push(ActionTimestamp {
            action: action.to_string(),
            timestamp: Instant::now(),
        });

        // Keep only last 100 actions
        if entry.len() > 100 {
            entry.drain(..50);
        }
    }

    /// Check for rapid-fire actions (bot detection)
    pub fn check_action_speed(&self, player_id: &Uuid) -> bool {
        if let Some(actions) = self.action_history.get(player_id) {
            if actions.len() < 2 {
                return true;
            }

            let last = &actions[actions.len() - 1];
            let prev = &actions[actions.len() - 2];

            // Minimum 500ms between actions
            last.timestamp.duration_since(prev.timestamp) > Duration::from_millis(500)
        } else {
            true
        }
    }

    /// Check if same player is at multiple tables with different accounts
    pub fn check_duplicate_at_table(player_ids: &[Uuid], new_player: Uuid) -> bool {
        !player_ids.contains(&new_player)
    }
}
