use std::collections::HashMap;
use uuid::Uuid;

use rand::SeedableRng;
use rand::seq::SliceRandom;
use rand_chacha::ChaCha20Rng;
use sha2::{Sha256, Digest};

use crate::engine::deck::{Card, Deck};

/// Generate a cryptographically secure server seed and its SHA-256 hash
pub fn generate_server_seed() -> (String, String) {
    let mut rng = ChaCha20Rng::from_entropy();
    let seed_bytes: [u8; 32] = rand::Rng::gen(&mut rng);
    let seed_hex = hex::encode(seed_bytes);

    let hash = Sha256::digest(seed_hex.as_bytes());
    let hash_hex = hex::encode(hash);

    (seed_hex, hash_hex)
}

/// Combine server seed with player seeds to create a deterministic shuffle seed
pub fn combine_seeds(server_seed: &str, player_seeds: &HashMap<Uuid, String>) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(server_seed.as_bytes());

    // Sort player seeds by UUID for deterministic ordering
    let mut sorted_seeds: Vec<(&Uuid, &String)> = player_seeds.iter().collect();
    sorted_seeds.sort_by_key(|(id, _)| *id);

    for (id, seed) in sorted_seeds {
        hasher.update(id.as_bytes());
        hasher.update(seed.as_bytes());
    }

    let result = hasher.finalize();
    let mut seed = [0u8; 32];
    seed.copy_from_slice(&result);
    seed
}

/// Perform a provably fair Fisher-Yates shuffle using ChaCha20 RNG
pub fn shuffle_deck(seed: &[u8; 32]) -> Vec<Card> {
    let mut rng = ChaCha20Rng::from_seed(*seed);
    let deck = Deck::new();
    let mut cards = deck.cards;
    cards.shuffle(&mut rng);
    cards
}

/// Verify that a server seed matches its hash
pub fn verify_seed(server_seed: &str, expected_hash: &str) -> bool {
    let hash = Sha256::digest(server_seed.as_bytes());
    let hash_hex = hex::encode(hash);
    hash_hex == expected_hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seed_generation_and_verification() {
        let (seed, hash) = generate_server_seed();
        assert!(verify_seed(&seed, &hash));
    }

    #[test]
    fn test_deterministic_shuffle() {
        let server_seed = "test_seed_12345";
        let player_seeds = HashMap::new();

        let combined1 = combine_seeds(server_seed, &player_seeds);
        let combined2 = combine_seeds(server_seed, &player_seeds);

        let deck1 = shuffle_deck(&combined1);
        let deck2 = shuffle_deck(&combined2);

        assert_eq!(deck1, deck2);
    }

    #[test]
    fn test_different_seeds_different_shuffle() {
        let combined1 = combine_seeds("seed_a", &HashMap::new());
        let combined2 = combine_seeds("seed_b", &HashMap::new());

        let deck1 = shuffle_deck(&combined1);
        let deck2 = shuffle_deck(&combined2);

        assert_ne!(deck1, deck2);
    }
}
