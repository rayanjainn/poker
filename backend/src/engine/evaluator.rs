use std::cmp::Ordering;
#[allow(unused_imports)]
use super::deck::{Card, Rank, Suit};
use serde::{Deserialize, Serialize};

/// Hand ranking from lowest to highest
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum HandRank {
    HighCard(Vec<u8>),
    OnePair(u8, Vec<u8>),
    TwoPair(u8, u8, Vec<u8>),
    ThreeOfAKind(u8, Vec<u8>),
    Straight(u8),
    Flush(Vec<u8>),
    FullHouse(u8, u8),
    FourOfAKind(u8, Vec<u8>),
    StraightFlush(u8),
    RoyalFlush,
}

impl HandRank {
    fn tier(&self) -> u8 {
        match self {
            HandRank::HighCard(_) => 0,
            HandRank::OnePair(_, _) => 1,
            HandRank::TwoPair(_, _, _) => 2,
            HandRank::ThreeOfAKind(_, _) => 3,
            HandRank::Straight(_) => 4,
            HandRank::Flush(_) => 5,
            HandRank::FullHouse(_, _) => 6,
            HandRank::FourOfAKind(_, _) => 7,
            HandRank::StraightFlush(_) => 8,
            HandRank::RoyalFlush => 9,
        }
    }

    pub fn description(&self) -> String {
        match self {
            HandRank::HighCard(_) => "High Card".to_string(),
            HandRank::OnePair(_, _) => "One Pair".to_string(),
            HandRank::TwoPair(_, _, _) => "Two Pair".to_string(),
            HandRank::ThreeOfAKind(_, _) => "Three of a Kind".to_string(),
            HandRank::Straight(_) => "Straight".to_string(),
            HandRank::Flush(_) => "Flush".to_string(),
            HandRank::FullHouse(_, _) => "Full House".to_string(),
            HandRank::FourOfAKind(_, _) => "Four of a Kind".to_string(),
            HandRank::StraightFlush(_) => "Straight Flush".to_string(),
            HandRank::RoyalFlush => "Royal Flush".to_string(),
        }
    }
}

impl PartialOrd for HandRank {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for HandRank {
    fn cmp(&self, other: &Self) -> Ordering {
        let tier_cmp = self.tier().cmp(&other.tier());
        if tier_cmp != Ordering::Equal {
            return tier_cmp;
        }

        match (self, other) {
            (HandRank::HighCard(a), HandRank::HighCard(b)) => a.cmp(b),
            (HandRank::OnePair(a_pair, a_kick), HandRank::OnePair(b_pair, b_kick)) => {
                a_pair.cmp(b_pair).then(a_kick.cmp(b_kick))
            }
            (HandRank::TwoPair(a_h, a_l, a_k), HandRank::TwoPair(b_h, b_l, b_k)) => {
                a_h.cmp(b_h).then(a_l.cmp(b_l)).then(a_k.cmp(b_k))
            }
            (HandRank::ThreeOfAKind(a_trip, a_kick), HandRank::ThreeOfAKind(b_trip, b_kick)) => {
                a_trip.cmp(b_trip).then(a_kick.cmp(b_kick))
            }
            (HandRank::Straight(a), HandRank::Straight(b)) => a.cmp(b),
            (HandRank::Flush(a), HandRank::Flush(b)) => a.cmp(b),
            (HandRank::FullHouse(a_trip, a_pair), HandRank::FullHouse(b_trip, b_pair)) => {
                a_trip.cmp(b_trip).then(a_pair.cmp(b_pair))
            }
            (HandRank::FourOfAKind(a_quad, a_kick), HandRank::FourOfAKind(b_quad, b_kick)) => {
                a_quad.cmp(b_quad).then(a_kick.cmp(b_kick))
            }
            (HandRank::StraightFlush(a), HandRank::StraightFlush(b)) => a.cmp(b),
            (HandRank::RoyalFlush, HandRank::RoyalFlush) => Ordering::Equal,
            _ => Ordering::Equal,
        }
    }
}

/// Evaluate the best 5-card hand from a set of cards (usually 7: 2 hole + 5 community)
pub fn evaluate_hand(cards: &[Card]) -> HandRank {
    if cards.len() < 5 {
        return HandRank::HighCard(cards.iter().map(|c| c.rank.value()).collect());
    }

    // Generate all 5-card combinations
    let combos = combinations(cards, 5);
    combos
        .into_iter()
        .map(|combo| evaluate_five(&combo))
        .max()
        .unwrap_or(HandRank::HighCard(vec![]))
}

fn combinations(cards: &[Card], k: usize) -> Vec<Vec<Card>> {
    if k == 0 {
        return vec![vec![]];
    }
    if cards.len() < k {
        return vec![];
    }

    let mut result = Vec::new();

    // Include first card
    let first = cards[0];
    for mut combo in combinations(&cards[1..], k - 1) {
        combo.insert(0, first);
        result.push(combo);
    }

    // Exclude first card
    result.extend(combinations(&cards[1..], k));

    result
}

fn evaluate_five(cards: &[Card]) -> HandRank {
    let mut ranks: Vec<u8> = cards.iter().map(|c| c.rank.value()).collect();
    ranks.sort_unstable_by(|a, b| b.cmp(a));

    let is_flush = cards.iter().all(|c| c.suit == cards[0].suit);
    let is_straight = is_straight_check(&ranks);

    // Check for ace-low straight (wheel)
    let is_wheel = ranks == vec![14, 5, 4, 3, 2];

    if is_flush && is_straight && ranks[0] == 14 && ranks[1] == 13 {
        return HandRank::RoyalFlush;
    }

    if is_flush && (is_straight || is_wheel) {
        let high = if is_wheel { 5 } else { ranks[0] };
        return HandRank::StraightFlush(high);
    }

    // Count rank occurrences
    let mut counts = [0u8; 15];
    for &r in &ranks {
        counts[r as usize] += 1;
    }

    let mut quads = Vec::new();
    let mut trips = Vec::new();
    let mut pairs = Vec::new();
    let mut singles = Vec::new();

    for i in (2..=14).rev() {
        match counts[i] {
            4 => quads.push(i as u8),
            3 => trips.push(i as u8),
            2 => pairs.push(i as u8),
            1 => singles.push(i as u8),
            _ => {}
        }
    }

    if !quads.is_empty() {
        let kicker: Vec<u8> = ranks.iter().filter(|&&r| r != quads[0]).cloned().take(1).collect();
        return HandRank::FourOfAKind(quads[0], kicker);
    }

    if !trips.is_empty() && !pairs.is_empty() {
        return HandRank::FullHouse(trips[0], pairs[0]);
    }

    if is_flush {
        return HandRank::Flush(ranks.clone());
    }

    if is_straight || is_wheel {
        let high = if is_wheel { 5 } else { ranks[0] };
        return HandRank::Straight(high);
    }

    if !trips.is_empty() {
        let kickers: Vec<u8> = ranks.iter().filter(|&&r| r != trips[0]).cloned().take(2).collect();
        return HandRank::ThreeOfAKind(trips[0], kickers);
    }

    if pairs.len() >= 2 {
        let kicker: Vec<u8> = ranks
            .iter()
            .filter(|&&r| r != pairs[0] && r != pairs[1])
            .cloned()
            .take(1)
            .collect();
        return HandRank::TwoPair(pairs[0], pairs[1], kicker);
    }

    if pairs.len() == 1 {
        let kickers: Vec<u8> = ranks.iter().filter(|&&r| r != pairs[0]).cloned().take(3).collect();
        return HandRank::OnePair(pairs[0], kickers);
    }

    HandRank::HighCard(ranks)
}

fn is_straight_check(sorted_desc: &[u8]) -> bool {
    if sorted_desc.len() < 5 {
        return false;
    }
    for i in 0..sorted_desc.len() - 1 {
        if sorted_desc[i] - sorted_desc[i + 1] != 1 {
            return false;
        }
    }
    true
}

/// Compare hands and return winners (indices of players with the best hand)
pub fn find_winners(hands: &[(usize, HandRank)]) -> Vec<usize> {
    if hands.is_empty() {
        return vec![];
    }

    let best = hands.iter().map(|(_, h)| h).max().unwrap();
    hands
        .iter()
        .filter(|(_, h)| h == best)
        .map(|(idx, _)| *idx)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn card(rank: Rank, suit: Suit) -> Card {
        Card::new(rank, suit)
    }

    #[test]
    fn test_royal_flush() {
        let cards = vec![
            card(Rank::Ace, Suit::Spades),
            card(Rank::King, Suit::Spades),
            card(Rank::Queen, Suit::Spades),
            card(Rank::Jack, Suit::Spades),
            card(Rank::Ten, Suit::Spades),
        ];
        assert_eq!(evaluate_hand(&cards), HandRank::RoyalFlush);
    }

    #[test]
    fn test_straight_flush() {
        let cards = vec![
            card(Rank::Nine, Suit::Hearts),
            card(Rank::Eight, Suit::Hearts),
            card(Rank::Seven, Suit::Hearts),
            card(Rank::Six, Suit::Hearts),
            card(Rank::Five, Suit::Hearts),
        ];
        assert_eq!(evaluate_hand(&cards), HandRank::StraightFlush(9));
    }

    #[test]
    fn test_four_of_a_kind() {
        let cards = vec![
            card(Rank::Ace, Suit::Spades),
            card(Rank::Ace, Suit::Hearts),
            card(Rank::Ace, Suit::Diamonds),
            card(Rank::Ace, Suit::Clubs),
            card(Rank::King, Suit::Spades),
        ];
        assert_eq!(evaluate_hand(&cards), HandRank::FourOfAKind(14, vec![13]));
    }

    #[test]
    fn test_full_house() {
        let cards = vec![
            card(Rank::King, Suit::Spades),
            card(Rank::King, Suit::Hearts),
            card(Rank::King, Suit::Diamonds),
            card(Rank::Queen, Suit::Clubs),
            card(Rank::Queen, Suit::Spades),
        ];
        assert_eq!(evaluate_hand(&cards), HandRank::FullHouse(13, 12));
    }

    #[test]
    fn test_wheel_straight() {
        let cards = vec![
            card(Rank::Ace, Suit::Spades),
            card(Rank::Two, Suit::Hearts),
            card(Rank::Three, Suit::Diamonds),
            card(Rank::Four, Suit::Clubs),
            card(Rank::Five, Suit::Spades),
        ];
        assert_eq!(evaluate_hand(&cards), HandRank::Straight(5));
    }

    #[test]
    fn test_best_from_seven() {
        let cards = vec![
            card(Rank::Ace, Suit::Spades),
            card(Rank::King, Suit::Spades),
            card(Rank::Queen, Suit::Spades),
            card(Rank::Jack, Suit::Spades),
            card(Rank::Ten, Suit::Spades),
            card(Rank::Two, Suit::Hearts),
            card(Rank::Three, Suit::Diamonds),
        ];
        assert_eq!(evaluate_hand(&cards), HandRank::RoyalFlush);
    }
}
