#![allow(dead_code)]
use sha2::{Sha256, Digest};

/// Commit-reveal scheme for fairness verification
pub struct CommitReveal {
    pub committed_hash: String,
    pub revealed_value: Option<String>,
}

impl CommitReveal {
    /// Create a new commit (hash the value)
    pub fn commit(value: &str) -> Self {
        let hash = Sha256::digest(value.as_bytes());
        Self {
            committed_hash: hex::encode(hash),
            revealed_value: None,
        }
    }

    /// Reveal the value and verify
    pub fn reveal(&mut self, value: &str) -> bool {
        let hash = Sha256::digest(value.as_bytes());
        let hash_hex = hex::encode(hash);

        if hash_hex == self.committed_hash {
            self.revealed_value = Some(value.to_string());
            true
        } else {
            false
        }
    }

    /// Verify that a value matches the commitment
    pub fn verify(value: &str, hash: &str) -> bool {
        let computed = Sha256::digest(value.as_bytes());
        hex::encode(computed) == hash
    }
}
