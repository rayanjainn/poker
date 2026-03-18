use std::collections::HashMap;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use chrono::Utc;

use super::betting::{self, ActionRecord, PlayerAction};
use super::deck::Deck;
use super::evaluator;
use super::hand::{HandPhase, HandState, Player, ShowdownResult};
use super::pot::PotManager;
use crate::fairness;
use crate::ws::messages::{GameStateMsg, PlayerInfo, ServerMessage};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum TableStatus {
    Waiting,
    Playing,
    BetweenHands,
}

/// The main poker table state machine
#[derive(Debug)]
pub struct PokerTable {
    pub id: Uuid,
    pub creator_id: Uuid,
    pub players: Vec<Player>,
    pub deck: Deck,
    pub hand_state: Option<HandState>,
    pub status: TableStatus,
    pub small_blind: i64,
    pub big_blind: i64,
    pub min_buy_in: i64,
    pub max_buy_in: i64,
    pub max_players: usize,
    pub hand_count: i64,
    pub dealer_index: usize,
    // Fairness
    pub server_seed: Option<String>,
    pub server_seed_hash: Option<String>,
    pub player_seeds: HashMap<Uuid, String>,
    pub pending_joins: Vec<crate::ws::messages::JoinRequestInfo>,
    pub turn_timeout_seconds: i64,
    pub next_hand_at: Option<i64>,
}

impl PokerTable {
    pub fn new(
        id: Uuid,
        creator_id: Uuid,
        small_blind: i64,
        big_blind: i64,
        min_buy_in: i64,
        max_buy_in: i64,
        max_players: usize,
    ) -> Self {
        Self {
            id,
            creator_id,
            players: Vec::new(),
            deck: Deck::new(),
            hand_state: None,
            status: TableStatus::Waiting,
            small_blind,
            big_blind,
            min_buy_in,
            max_buy_in,
            max_players,
            hand_count: 0,
            dealer_index: 0,
            server_seed: None,
            server_seed_hash: None,
            player_seeds: HashMap::new(),
            pending_joins: Vec::new(),
            turn_timeout_seconds: 30,
            next_hand_at: None,
        }
    }

    pub fn add_player(
        &mut self,
        id: Uuid,
        display_name: String,
        avatar_url: Option<String>,
        buy_in: i64,
    ) -> Result<usize, String> {
        if self.players.len() >= self.max_players {
            return Err("Table is full".to_string());
        }
        if self.players.iter().any(|p| p.id == id) {
            return Err("Player already at table".to_string());
        }
        if buy_in < self.min_buy_in || buy_in > self.max_buy_in {
            return Err(format!(
                "Buy-in must be between {} and {}",
                self.min_buy_in, self.max_buy_in
            ));
        }

        // Find first available seat
        let taken_seats: Vec<usize> = self.players.iter().map(|p| p.seat).collect();
        let seat = (0..self.max_players)
            .find(|s| !taken_seats.contains(s))
            .ok_or("No seats available")?;

        self.players.push(Player::new(id, display_name, avatar_url, buy_in, seat));
        Ok(seat)
    }

    pub fn remove_player(&mut self, player_id: Uuid) -> Option<Player> {
        if let Some(pos) = self.players.iter().position(|p| p.id == player_id) {
            let mut result_messages = Vec::new();
            
            // If in active hand, handle their departure
            if let Some(ref mut hand) = self.hand_state {
                if let Some(player) = self.players.get_mut(pos) {
                    player.is_folded = true;
                }
                
                // If it was this player's turn, advance
                if hand.action_on == Some(player_id) {
                    if self.is_round_complete() {
                        if let Ok(m) = self.advance_phase() {
                            result_messages.extend(m);
                        }
                    } else {
                        self.advance_action();
                    }
                }
            }
            
            let removed = self.players.remove(pos);

            // If the creator left, transfer leadership to the next player
            if player_id == self.creator_id && !self.players.is_empty() {
                self.creator_id = self.players[0].id;
            }

            Some(removed)
        } else {
            None
        }
    }

    /// Helper to get messages after a player leaves (since remove_player returns Option<Player>)
    /// In a more refined architecture, remote_player would return (Option<Player>, Vec<ServerMessage>)
    pub fn get_messages_after_leave(&mut self) -> Vec<ServerMessage> {
        let mut messages = Vec::new();
        // Since we already modified state in remove_player, we just need to build GameState
        messages.push(self.build_game_state_message());
        messages
    }

    /// Start a new hand
    pub fn start_hand(&mut self) -> Result<Vec<ServerMessage>, String> {
        let active_player_ids: Vec<Uuid> = self.players.iter()
            .filter(|p| p.chips > 0)
            .map(|p| p.id)
            .collect();

        if active_player_ids.len() < 2 {
            return Err("Need at least 2 players with chips to start".to_string());
        }

        self.hand_count += 1;

        // Advance dealer
        if self.hand_count > 1 {
            self.dealer_index = self.next_available_seat(self.dealer_index);
        } else if !self.players.is_empty() {
            // First hand: find first player with chips
            self.dealer_index = self.next_available_seat(self.max_players - 1);
        }

        let sb_seat;
        let bb_seat;

        if active_player_ids.len() == 2 {
            // Heads-up: Dealer is SB, other player is BB
            sb_seat = self.dealer_index;
            bb_seat = self.next_available_seat(sb_seat);
        } else {
            // 3+ players: SB is after dealer, BB is after SB
            sb_seat = self.next_available_seat(self.dealer_index);
            bb_seat = self.next_available_seat(sb_seat);
        }

        self.status = TableStatus::Playing;

        // Reset players for new hand
        for player in self.players.iter_mut() {
            if active_player_ids.contains(&player.id) {
                player.reset_for_new_hand();
                player.is_sitting_out = false; // Auto sit-in if they have chips
            } else {
                player.is_sitting_out = true;
                player.is_folded = true;
                player.hole_cards.clear();
            }
        }

        // Generate provably fair shuffle
        let (seed, hash) = fairness::shuffle::generate_server_seed();
        self.server_seed = Some(seed.clone());
        self.server_seed_hash = Some(hash.clone());

        // Combine with player seeds for shuffle
        let combined_seed = fairness::shuffle::combine_seeds(&seed, &self.player_seeds);
        let shuffled_cards = fairness::shuffle::shuffle_deck(&combined_seed);
        self.deck.set_cards(shuffled_cards);

        let mut messages = Vec::new();

        // Post blinds
        if let Some(sb_player) = self.players.iter_mut().find(|p| p.seat == sb_seat) {
            let sb_amount = sb_player.place_bet(self.small_blind);
            messages.push(ServerMessage::PlayerAction {
                player_id: sb_player.id,
                action: "small_blind".to_string(),
                amount: sb_amount,
            });
        }

        if let Some(bb_player) = self.players.iter_mut().find(|p| p.seat == bb_seat) {
            let bb_amount = bb_player.place_bet(self.big_blind);
            messages.push(ServerMessage::PlayerAction {
                player_id: bb_player.id,
                action: "big_blind".to_string(),
                amount: bb_amount,
            });
        }

        // Create hand state after blinds are posted to capture all-ins
        let mut hand = HandState::new(
            self.hand_count,
            self.dealer_index,
            sb_seat,
            bb_seat,
            self.big_blind,
            active_player_ids.clone(),
        );

        // Track players who are now all-in after blinds
        for player in &self.players {
            if player.is_all_in && active_player_ids.contains(&player.id) {
                hand.all_in_at_start.push(player.id);
            }
        }

        // Deal hole cards
        for player in self.players.iter_mut() {
            if !player.is_sitting_out && player.chips >= 0 { // Chips can be 0 if they just posted blind
                player.hole_cards = self.deck.deal_n(2);
            }
        }

        // Set action on first player after BB
        let first_to_act = self.next_active_seat(bb_seat);
        if let Some(player) = self.players.iter().find(|p| p.seat == first_to_act) {
            hand.action_on = Some(player.id);
        }

        self.hand_state = Some(hand);

        // Send cards to each player individually
        for player in &self.players {
            if !player.hole_cards.is_empty() {
                messages.push(ServerMessage::CardsDealt {
                    player_id: player.id,
                    cards: player.hole_cards.clone(),
                    phase: "preflop".to_string(),
                });
            }
        }

        messages.push(self.build_game_state_message());

        Ok(messages)
    }

    /// Process a player action
    pub fn process_action(
        &mut self,
        player_id: Uuid,
        action: PlayerAction,
    ) -> Result<Vec<ServerMessage>, String> {
        let hand = self.hand_state.as_ref().ok_or("No active hand")?;

        // Verify it's this player's turn
        if hand.action_on != Some(player_id) {
            return Err("Not your turn".to_string());
        }

        let player = self
            .players
            .iter()
            .find(|p| p.id == player_id)
            .ok_or("Player not found")?;

        // Validate the action
        let amount = betting::validate_action(
            &action,
            player.chips,
            hand.current_bet,
            player.current_bet,
            hand.min_raise,
            self.big_blind,
        )?;

        let mut messages = Vec::new();

        // Apply the action
        let phase = self.hand_state.as_ref().unwrap().phase.as_str().to_string();
        match &action {
            PlayerAction::Fold => {
                let player = self.players.iter_mut().find(|p| p.id == player_id).unwrap();
                player.is_folded = true;
            }
            PlayerAction::Check => {
                // Nothing to do
            }
            PlayerAction::Call => {
                let player = self.players.iter_mut().find(|p| p.id == player_id).unwrap();
                player.place_bet(amount);
            }
            PlayerAction::Raise(_) => {
                let player = self.players.iter_mut().find(|p| p.id == player_id).unwrap();
                let new_total = player.current_bet + amount;
                player.place_bet(amount);

                let hand = self.hand_state.as_mut().unwrap();
                hand.min_raise = new_total - hand.current_bet;
                hand.current_bet = new_total;
                hand.last_raiser = Some(player_id);
                hand.players_acted_this_round.clear();
            }
            PlayerAction::AllIn => {
                let player = self.players.iter_mut().find(|p| p.id == player_id).unwrap();
                let new_total = player.current_bet + amount;
                player.place_bet(amount);

                let hand = self.hand_state.as_mut().unwrap();
                if new_total > hand.current_bet {
                    hand.min_raise = new_total - hand.current_bet;
                    hand.current_bet = new_total;
                    hand.last_raiser = Some(player_id);
                    hand.players_acted_this_round.clear();
                }
            }
        }

        // Record action
        let hand = self.hand_state.as_mut().unwrap();
        hand.actions.push(ActionRecord {
            player_id,
            action: action.clone(),
            amount,
            phase: phase.clone(),
        });
        hand.players_acted_this_round.push(player_id);

        messages.push(ServerMessage::PlayerAction {
            player_id,
            action: action.as_str().to_string(),
            amount,
        });

        // Check if round is complete
        if self.is_round_complete() {
            let round_messages = self.advance_phase()?;
            messages.extend(round_messages);
        } else {
            // Move to next player
            self.advance_action();
        }

        messages.push(self.build_game_state_message());
        Ok(messages)
    }

    fn is_round_complete(&self) -> bool {
        let hand = match &self.hand_state {
            Some(h) => h,
            None => return false,
        };

        let active_players: Vec<&Player> = self
            .players
            .iter()
            .filter(|p| !p.is_folded && !p.is_sitting_out && !p.is_all_in)
            .collect();

        // Only one non-folded player = hand over
        let non_folded = self.players.iter().filter(|p| !p.is_folded && !p.is_sitting_out).count();
        if non_folded <= 1 {
            return true;
        }

        // All active (non-all-in) players have acted and bets are equal
        if active_players.is_empty() {
            return true; // Everyone is all-in
        }

        let all_acted = active_players
            .iter()
            .all(|p| hand.players_acted_this_round.contains(&p.id));

        let bets_equal = active_players
            .iter()
            .all(|p| p.current_bet == hand.current_bet);

        all_acted && bets_equal
    }

    fn advance_phase(&mut self) -> Result<Vec<ServerMessage>, String> {
        let mut messages = Vec::new();

        // Check if only one player remains
        let active: Vec<Uuid> = self
            .players
            .iter()
            .filter(|p| !p.is_folded && !p.is_sitting_out)
            .map(|p| p.id)
            .collect();

        if active.len() <= 1 {
            return self.finish_hand();
        }

        let hand = self.hand_state.as_mut().unwrap();
        hand.phase = hand.phase.next();

        // Reset for new round
        for player in self.players.iter_mut() {
            player.reset_for_new_round();
        }

        let hand = self.hand_state.as_mut().unwrap();
        hand.current_bet = 0;
        hand.min_raise = self.big_blind;
        hand.last_raiser = None;
        hand.players_acted_this_round.clear();

        match hand.phase {
            HandPhase::Flop => {
                self.deck.deal(); // burn
                let flop = self.deck.deal_n(3);
                let hand = self.hand_state.as_mut().unwrap();
                hand.community_cards.extend_from_slice(&flop);
                messages.push(ServerMessage::CommunityCards {
                    cards: flop,
                    phase: "flop".to_string(),
                });
            }
            HandPhase::Turn => {
                self.deck.deal(); // burn
                let turn = self.deck.deal_n(1);
                let hand = self.hand_state.as_mut().unwrap();
                hand.community_cards.extend_from_slice(&turn);
                messages.push(ServerMessage::CommunityCards {
                    cards: turn,
                    phase: "turn".to_string(),
                });
            }
            HandPhase::River => {
                self.deck.deal(); // burn
                let river = self.deck.deal_n(1);
                let hand = self.hand_state.as_mut().unwrap();
                hand.community_cards.extend_from_slice(&river);
                messages.push(ServerMessage::CommunityCards {
                    cards: river,
                    phase: "river".to_string(),
                });
            }
            HandPhase::Showdown => {
                return self.finish_hand();
            }
            _ => {}
        }

        // Set action to first active player after dealer
        let next_seat = self.next_active_betting_seat(self.dealer_index);
        if let Some(player) = self.players.iter().find(|p| p.seat == next_seat && !p.is_folded && !p.is_all_in) {
            let hand = self.hand_state.as_mut().unwrap();
            hand.action_on = Some(player.id);
            self.reset_turn_timer();
        } else {
            // All remaining players are all-in, run out the board
            let remaining_messages = self.run_out_board()?;
            messages.extend(remaining_messages);
        }

        Ok(messages)
    }

    fn run_out_board(&mut self) -> Result<Vec<ServerMessage>, String> {
        let mut messages = Vec::new();
        let hand = self.hand_state.as_mut().unwrap();

        while hand.community_cards.len() < 5 {
            self.deck.deal(); // burn
            let card = self.deck.deal_n(1);
            let phase = match hand.community_cards.len() {
                0..=2 => "flop",
                3 => "turn",
                _ => "river",
            };
            hand.community_cards.extend_from_slice(&card);
            messages.push(ServerMessage::CommunityCards {
                cards: card,
                phase: phase.to_string(),
            });
        }

        let finish_messages = self.finish_hand()?;
        messages.extend(finish_messages);
        Ok(messages)
    }

    fn finish_hand(&mut self) -> Result<Vec<ServerMessage>, String> {
        let mut messages = Vec::new();

        let active_players: Vec<&Player> = self
            .players
            .iter()
            .filter(|p| !p.is_folded && !p.is_sitting_out)
            .collect();

        // Calculate pots
        let contributions: Vec<(Uuid, i64)> = self
            .players
            .iter()
            .filter(|p| !p.is_sitting_out)
            .map(|p| (p.id, p.total_bet_this_hand))
            .collect();

        let active_ids: Vec<Uuid> = active_players.iter().map(|p| p.id).collect();
        let pot_manager = PotManager::calculate_pots(&contributions, &active_ids);

        // Determine winners for each pot
        let hand = self.hand_state.as_ref().unwrap();
        let mut results: Vec<ShowdownResult> = Vec::new();

        if active_players.len() == 1 {
            // Last player standing wins
            let winner = active_players[0];
            let total_pot = pot_manager.total();
            results.push(ShowdownResult {
                player_id: winner.id,
                hand_rank: evaluator::HandRank::HighCard(vec![]),
                best_cards: vec![],
                winnings: total_pot,
            });
        } else {
            // Evaluate hands
            let mut evaluated: Vec<(usize, Uuid, evaluator::HandRank)> = Vec::new();
            for (i, player) in active_players.iter().enumerate() {
                let mut all_cards = player.hole_cards.clone();
                all_cards.extend_from_slice(&hand.community_cards);
                let rank = evaluator::evaluate_hand(&all_cards);
                evaluated.push((i, player.id, rank));
            }

            // Find winners for each pot and distribute
            let mut winners_per_pot = Vec::new();
            for pot in &pot_manager.pots {
                let eligible_hands: Vec<(usize, evaluator::HandRank)> = evaluated
                    .iter()
                    .filter(|(_, id, _)| pot.eligible_players.contains(id))
                    .map(|(i, _, rank)| (*i, rank.clone()))
                    .collect();

                let winner_indices = evaluator::find_winners(&eligible_hands);
                let pot_winners: Vec<Uuid> = winner_indices
                    .iter()
                    .map(|&i| evaluated[i].1)
                    .collect();
                winners_per_pot.push(pot_winners);
            }

            let distributions = pot_manager.distribute(&winners_per_pot);

            for (i, player) in active_players.iter().enumerate() {
                let winnings = distributions.iter()
                    .find(|(id, _)| *id == player.id)
                    .map(|(_, w)| *w)
                    .unwrap_or(0);
                
                let (_, _, rank) = &evaluated[i];
                
                results.push(ShowdownResult {
                    player_id: player.id,
                    hand_rank: rank.clone(),
                    best_cards: player.hole_cards.clone(),
                    winnings,
                });
            }
        }

        // Apply winnings
        for result in &results {
            if let Some(player) = self.players.iter_mut().find(|p| p.id == result.player_id) {
                player.chips += result.winnings;
            }
        }

        // Reveal server seed
        let hand = self.hand_state.as_mut().unwrap();
        hand.phase = HandPhase::Complete;
        hand.action_on = None;

        messages.push(ServerMessage::HandResult {
            results: results
                .iter()
                .map(|r| crate::ws::messages::HandResultInfo {
                    player_id: r.player_id,
                    hand_rank: r.hand_rank.description(),
                    cards: r.best_cards.clone(),
                    winnings: r.winnings,
                })
                .collect(),
            pot_total: pot_manager.total(),
            server_seed: self.server_seed.clone(),
            server_seed_hash: self.server_seed_hash.clone(),
        });

        self.status = TableStatus::BetweenHands;
        self.next_hand_at = Some(Utc::now().timestamp_millis() + 6000); // Start next hand in 6 seconds

        Ok(messages)
    }

    fn advance_action(&mut self) {
        let hand = self.hand_state.as_ref().unwrap();
        let current_player = hand.action_on.and_then(|id| {
            self.players.iter().find(|p| p.id == id)
        });

        if let Some(player) = current_player {
            let current_seat = player.seat;
            let next = self.next_active_betting_seat(current_seat);
            if let Some(next_player) = self.players.iter().find(|p| p.seat == next && !p.is_folded && !p.is_all_in) {
                let hand = self.hand_state.as_mut().unwrap();
                hand.action_on = Some(next_player.id);
                self.reset_turn_timer();
            }
        }
    }

    fn reset_turn_timer(&mut self) {
        if let Some(hand) = self.hand_state.as_mut() {
            if hand.action_on.is_some() {
                let now = Utc::now().timestamp_millis();
                hand.turn_expires_at = Some(now + (self.turn_timeout_seconds * 1000));
            } else {
                hand.turn_expires_at = None;
            }
        }
    }

    fn next_available_seat(&self, from: usize) -> usize {
        let total = self.max_players;
        for i in 1..=total {
            let seat = (from + i) % total;
            if self.players.iter().any(|p| p.seat == seat && p.chips > 0) {
                return seat;
            }
        }
        from
    }

    fn next_active_seat(&self, from: usize) -> usize {
        let total = self.max_players;
        for i in 1..=total {
            let seat = (from + i) % total;
            // A player is "active" at table if they have chips and are not sitting out
            if self.players.iter().any(|p| p.seat == seat && !p.is_sitting_out && p.chips > 0) {
                return seat;
            }
        }
        from
    }

    fn next_active_betting_seat(&self, from: usize) -> usize {
        let total = self.max_players;
        for i in 1..=total {
            let seat = (from + i) % total;
            // A player can "act" if they are in the hand, not folded, and have chips (not all-in)
            if let Some(p) = self.players.iter().find(|p| p.seat == seat) {
                if p.is_active() {
                    return seat;
                }
            }
        }
        from
    }

    pub fn build_game_state_message(&self) -> ServerMessage {
        let hand = self.hand_state.as_ref();

        let players: Vec<PlayerInfo> = self
            .players
            .iter()
            .map(|p| {
                let mut current_hand_rank = None;
                if let Some(h) = hand {
                    if !p.is_folded && !p.is_sitting_out && !p.hole_cards.is_empty() {
                        let mut all_cards = p.hole_cards.clone();
                        all_cards.extend(h.community_cards.iter().cloned());
                        current_hand_rank = Some(evaluator::evaluate_hand(&all_cards).description());
                    }
                }

                PlayerInfo {
                    id: p.id,
                    display_name: p.display_name.clone(),
                    avatar_url: p.avatar_url.clone(),
                    chips: p.chips,
                    seat: p.seat,
                    is_folded: p.is_folded,
                    is_all_in: p.is_all_in,
                    is_sitting_out: p.is_sitting_out,
                    current_bet: p.current_bet,
                    is_dealer: hand.map_or(false, |h| h.dealer_seat == p.seat),
                    current_hand_rank,
                }
            })
            .collect();

        let contributions: Vec<(Uuid, i64)> = self
            .players
            .iter()
            .filter(|p| !p.is_sitting_out)
            .map(|p| (p.id, p.total_bet_this_hand))
            .collect();
        let pot_total: i64 = contributions.iter().map(|(_, a)| a).sum();

        ServerMessage::GameState(GameStateMsg {
            table_id: self.id,
            status: format!("{:?}", self.status),
            phase: hand.map(|h| h.phase.as_str().to_string()),
            community_cards: hand.map(|h| h.community_cards.clone()).unwrap_or_default(),
            pot: pot_total,
            current_bet: hand.map(|h| h.current_bet).unwrap_or(0),
            action_on: hand.and_then(|h| h.action_on),
            dealer_seat: hand.map(|h| h.dealer_seat),
            players,
            small_blind: self.small_blind,
            big_blind: self.big_blind,
            hand_number: hand.map(|h| h.hand_number),
            server_seed_hash: self.server_seed_hash.clone(),
            creator_id: self.creator_id,
            pending_joins: self.pending_joins.clone(),
            turn_expires_at: hand.and_then(|h| h.turn_expires_at),
            turn_timeout_seconds: self.turn_timeout_seconds,
        })
    }

    pub fn set_player_seed(&mut self, player_id: Uuid, seed: String) {
        self.player_seeds.insert(player_id, seed);
    }

    pub fn check_timeouts(&mut self) -> Option<Vec<ServerMessage>> {
        let now = Utc::now().timestamp_millis();
        let mut messages = Vec::new();

        // Check turn timeouts during a hand
        if let Some(hand) = &self.hand_state {
            if let (Some(expires), Some(player_id)) = (hand.turn_expires_at, hand.action_on) {
                if now >= expires {
                    tracing::info!("Player {} timeout! Auto-folding...", player_id);
                    match self.process_action(player_id, PlayerAction::Fold) {
                        Ok(mut msgs) => {
                            messages.append(&mut msgs);
                        }
                        Err(e) => {
                            tracing::error!("Timeout auto-fold failed: {:?}", e);
                        }
                    }
                }
            }
        }

        // Check auto-start for next hand
        if self.status == TableStatus::BetweenHands {
            if let Some(next_at) = self.next_hand_at {
                if now >= next_at {
                    tracing::info!("Starting next hand automatically...");
                    self.next_hand_at = None;
                    match self.start_hand() {
                        Ok(mut msgs) => {
                            messages.append(&mut msgs);
                        }
                        Err(e) => {
                            tracing::error!("Auto-start hand failed: {}", e);
                            // If it failed because of not enough players, it's fine, it will stay in BetweenHands
                            self.status = TableStatus::Waiting;
                        }
                    }
                }
            }
        }

        if messages.is_empty() {
            None
        } else {
            Some(messages)
        }
    }
}
