use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Pot management including side pots
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PotManager {
    pub pots: Vec<Pot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pot {
    pub amount: i64,
    pub eligible_players: Vec<Uuid>,
}

impl PotManager {
    pub fn new() -> Self {
        Self {
            pots: vec![Pot {
                amount: 0,
                eligible_players: Vec::new(),
            }],
        }
    }

    pub fn total(&self) -> i64 {
        self.pots.iter().map(|p| p.amount).sum()
    }

    /// Calculate pots from player contributions, creating side pots as needed
    pub fn calculate_pots(contributions: &[(Uuid, i64)], active_players: &[Uuid]) -> Self {
        if contributions.is_empty() {
            return Self::new();
        }

        let mut sorted: Vec<(Uuid, i64)> = contributions.to_vec();
        sorted.sort_by_key(|(_, amount)| *amount);

        let mut pots = Vec::new();
        let mut prev_level = 0i64;

        for i in 0..sorted.len() {
            let (_, amount) = sorted[i];
            if amount <= prev_level {
                continue;
            }

            let level_contribution = amount - prev_level;
            let pot_amount: i64 = sorted
                .iter()
                .filter(|(_, a)| *a > prev_level)
                .count() as i64
                * level_contribution;

            let eligible: Vec<Uuid> = sorted
                .iter()
                .filter(|(id, a)| *a >= amount && active_players.contains(id))
                .map(|(id, _)| *id)
                .collect();

            if pot_amount > 0 {
                pots.push(Pot {
                    amount: pot_amount,
                    eligible_players: eligible,
                });
            }

            prev_level = amount;
        }

        if pots.is_empty() {
            Self::new()
        } else {
            Self { pots }
        }
    }

    /// Distribute pots to winners, returning (player_id, amount_won) pairs
    pub fn distribute(&self, winners_per_pot: &[Vec<Uuid>]) -> Vec<(Uuid, i64)> {
        let mut distributions: std::collections::HashMap<Uuid, i64> = std::collections::HashMap::new();

        for (i, pot) in self.pots.iter().enumerate() {
            let pot_winners: Vec<&Uuid> = if i < winners_per_pot.len() {
                winners_per_pot[i]
                    .iter()
                    .filter(|w| pot.eligible_players.contains(w))
                    .collect()
            } else {
                pot.eligible_players.iter().take(1).collect()
            };

            if pot_winners.is_empty() {
                // If no winners are eligible, give to first eligible player
                if let Some(player) = pot.eligible_players.first() {
                    *distributions.entry(*player).or_insert(0) += pot.amount;
                }
                continue;
            }

            let share = pot.amount / pot_winners.len() as i64;
            let remainder = pot.amount % pot_winners.len() as i64;

            for (j, winner) in pot_winners.iter().enumerate() {
                let mut amount = share;
                if j == 0 {
                    amount += remainder; // First winner gets remainder
                }
                *distributions.entry(**winner).or_insert(0) += amount;
            }
        }

        distributions.into_iter().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_pot() {
        let p1 = Uuid::new_v4();
        let p2 = Uuid::new_v4();
        let contributions = vec![(p1, 100), (p2, 100)];
        let active = vec![p1, p2];

        let pots = PotManager::calculate_pots(&contributions, &active);
        assert_eq!(pots.total(), 200);
        assert_eq!(pots.pots.len(), 1);
    }

    #[test]
    fn test_side_pot() {
        let p1 = Uuid::new_v4();
        let p2 = Uuid::new_v4();
        let p3 = Uuid::new_v4();

        // p1 goes all-in for 50, p2 and p3 bet 100
        let contributions = vec![(p1, 50), (p2, 100), (p3, 100)];
        let active = vec![p1, p2, p3];

        let pots = PotManager::calculate_pots(&contributions, &active);
        assert_eq!(pots.total(), 250);
        assert_eq!(pots.pots.len(), 2);

        // Main pot: 3 * 50 = 150 (all eligible)
        assert_eq!(pots.pots[0].amount, 150);
        assert_eq!(pots.pots[0].eligible_players.len(), 3);

        // Side pot: 2 * 50 = 100 (only p2 and p3)
        assert_eq!(pots.pots[1].amount, 100);
        assert_eq!(pots.pots[1].eligible_players.len(), 2);
    }
}
