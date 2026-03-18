use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::betting::ActionRecord;
use super::deck::Card;
use super::evaluator::HandRank;

/// Phases of a poker hand
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum HandPhase {
    PreFlop,
    Flop,
    Turn,
    River,
    Showdown,
    Complete,
}

impl HandPhase {
    pub fn as_str(&self) -> &str {
        match self {
            HandPhase::PreFlop => "preflop",
            HandPhase::Flop => "flop",
            HandPhase::Turn => "turn",
            HandPhase::River => "river",
            HandPhase::Showdown => "showdown",
            HandPhase::Complete => "complete",
        }
    }

    pub fn next(&self) -> HandPhase {
        match self {
            HandPhase::PreFlop => HandPhase::Flop,
            HandPhase::Flop => HandPhase::Turn,
            HandPhase::Turn => HandPhase::River,
            HandPhase::River => HandPhase::Showdown,
            HandPhase::Showdown => HandPhase::Complete,
            HandPhase::Complete => HandPhase::Complete,
        }
    }
}

/// Represents a player at the table
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: Uuid,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub chips: i64,
    pub hole_cards: Vec<Card>,
    pub is_folded: bool,
    pub is_all_in: bool,
    pub is_sitting_out: bool,
    pub current_bet: i64,
    pub total_bet_this_hand: i64,
    pub seat: usize,
}

impl Player {
    pub fn new(id: Uuid, display_name: String, avatar_url: Option<String>, chips: i64, seat: usize) -> Self {
        Self {
            id,
            display_name,
            avatar_url,
            chips,
            hole_cards: Vec::new(),
            is_folded: false,
            is_all_in: false,
            is_sitting_out: false,
            current_bet: 0,
            total_bet_this_hand: 0,
            seat,
        }
    }

    pub fn is_active(&self) -> bool {
        !self.is_folded && !self.is_sitting_out && !self.is_all_in && self.chips > 0
    }

    pub fn reset_for_new_hand(&mut self) {
        self.hole_cards.clear();
        self.is_folded = false;
        self.is_all_in = false;
        self.current_bet = 0;
        self.total_bet_this_hand = 0;
    }

    pub fn reset_for_new_round(&mut self) {
        self.current_bet = 0;
    }

    pub fn place_bet(&mut self, amount: i64) -> i64 {
        let actual = amount.min(self.chips);
        self.chips -= actual;
        self.current_bet += actual;
        self.total_bet_this_hand += actual;

        if self.chips == 0 {
            self.is_all_in = true;
        }

        actual
    }
}

/// Hand state tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandState {
    pub hand_id: Uuid,
    pub hand_number: i64,
    pub phase: HandPhase,
    pub community_cards: Vec<Card>,
    pub current_bet: i64,
    pub min_raise: i64,
    pub action_on: Option<Uuid>,
    pub dealer_seat: usize,
    pub small_blind_seat: usize,
    pub big_blind_seat: usize,
    pub actions: Vec<ActionRecord>,
    pub last_raiser: Option<Uuid>,
    pub players_acted_this_round: Vec<Uuid>,
    pub active_players: Vec<Uuid>,
    pub all_in_at_start: Vec<Uuid>,
    pub turn_expires_at: Option<i64>,
}

impl HandState {
    pub fn new(
        hand_number: i64,
        dealer_seat: usize,
        sb_seat: usize,
        bb_seat: usize,
        big_blind: i64,
        active_players: Vec<Uuid>,
    ) -> Self {
        Self {
            hand_id: Uuid::new_v4(),
            hand_number,
            phase: HandPhase::PreFlop,
            community_cards: Vec::new(),
            current_bet: big_blind,
            min_raise: big_blind,
            action_on: None,
            dealer_seat,
            small_blind_seat: sb_seat,
            big_blind_seat: bb_seat,
            actions: Vec::new(),
            last_raiser: None,
            players_acted_this_round: Vec::new(),
            active_players,
            all_in_at_start: Vec::new(),
            turn_expires_at: None,
        }
    }
}

/// Result of a showdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShowdownResult {
    pub player_id: Uuid,
    pub hand_rank: HandRank,
    pub best_cards: Vec<Card>,
    pub winnings: i64,
}
