#![allow(dead_code)]
/// Input validation helpers
pub fn validate_username(username: &str) -> Result<(), String> {
    if username.len() < 3 || username.len() > 50 {
        return Err("Username must be between 3 and 50 characters".to_string());
    }
    if !username.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err("Username can only contain alphanumeric characters and underscores".to_string());
    }
    Ok(())
}

pub fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 8 {
        return Err("Password must be at least 8 characters".to_string());
    }
    Ok(())
}

pub fn validate_table_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name.len() > 100 {
        return Err("Table name must be between 1 and 100 characters".to_string());
    }
    Ok(())
}

pub fn validate_buy_in(buy_in: i64, min: i64, max: i64) -> Result<(), String> {
    if buy_in < min || buy_in > max {
        return Err(format!("Buy-in must be between {} and {}", min, max));
    }
    Ok(())
}

pub fn validate_blinds(small_blind: i64, big_blind: i64) -> Result<(), String> {
    if small_blind <= 0 || big_blind <= 0 {
        return Err("Blinds must be positive".to_string());
    }
    if big_blind != small_blind * 2 {
        return Err("Big blind must be exactly 2x small blind".to_string());
    }
    Ok(())
}
