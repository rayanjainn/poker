use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PlayerAction {
    Fold,
    Check,
    Call,
    Raise(i64),
    AllIn,
}

impl PlayerAction {
    pub fn as_str(&self) -> &str {
        match self {
            PlayerAction::Fold => "fold",
            PlayerAction::Check => "check",
            PlayerAction::Call => "call",
            PlayerAction::Raise(_) => "raise",
            PlayerAction::AllIn => "all_in",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionRecord {
    pub player_id: Uuid,
    pub action: PlayerAction,
    pub amount: i64,
    pub phase: String,
}

/// Validates that a player action is legal given the current game state
pub fn validate_action(
    action: &PlayerAction,
    player_chips: i64,
    current_bet: i64,
    player_current_bet: i64,
    min_raise: i64,
    _big_blind: i64,
) -> Result<i64, String> {
    let to_call = current_bet - player_current_bet;

    match action {
        PlayerAction::Fold => Ok(0),

        PlayerAction::Check => {
            if to_call > 0 {
                Err("Cannot check when there's a bet to call".to_string())
            } else {
                Ok(0)
            }
        }

        PlayerAction::Call => {
            if to_call == 0 {
                Err("Nothing to call, use check instead".to_string())
            } else {
                let call_amount = to_call.min(player_chips);
                Ok(call_amount)
            }
        }

        PlayerAction::Raise(amount) => {
            let raise_amount = *amount;
            let total_bet = player_current_bet + raise_amount;

            if raise_amount > player_chips {
                Err("Insufficient chips for raise".to_string())
            } else if total_bet < current_bet + min_raise && raise_amount < player_chips {
                Err(format!(
                    "Raise must be at least {} (min raise: {})",
                    current_bet + min_raise - player_current_bet,
                    min_raise
                ))
            } else {
                Ok(raise_amount)
            }
        }

        PlayerAction::AllIn => {
            Ok(player_chips)
        }
    }
}
