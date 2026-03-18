use serde::{Deserialize, Serialize};

/// Poker variant rule engine (extensible for future variants)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PokerVariant {
    TexasHoldem,
    Omaha,
    Custom(String),
}

impl PokerVariant {
    pub fn hole_cards_count(&self) -> usize {
        match self {
            PokerVariant::TexasHoldem => 2,
            PokerVariant::Omaha => 4,
            PokerVariant::Custom(_) => 2,
        }
    }

    pub fn community_cards_count(&self) -> usize {
        match self {
            PokerVariant::TexasHoldem => 5,
            PokerVariant::Omaha => 5,
            PokerVariant::Custom(_) => 5,
        }
    }

    pub fn name(&self) -> &str {
        match self {
            PokerVariant::TexasHoldem => "Texas Hold'em",
            PokerVariant::Omaha => "Omaha",
            PokerVariant::Custom(name) => name,
        }
    }
}

impl Default for PokerVariant {
    fn default() -> Self {
        PokerVariant::TexasHoldem
    }
}

impl From<&str> for PokerVariant {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "texas_holdem" | "holdem" => PokerVariant::TexasHoldem,
            "omaha" => PokerVariant::Omaha,
            other => PokerVariant::Custom(other.to_string()),
        }
    }
}
