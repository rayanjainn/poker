use sqlx::postgres::PgConnectOptions;
use sqlx::ConnectOptions;
use std::str::FromStr;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let url = std::env::var("DATABASE_URL")?;
    
    println!("Testing connection to: {}", url.split('@').last().unwrap_or("URL"));
    
    let mut options = PgConnectOptions::from_str(&url)?;
    options = options.log_statements(tracing::log::LevelFilter::Debug);
    
    // Explicitly set a very long timeout and no pool for testing
    let conn_result = tokio::time::timeout(
        Duration::from_secs(30),
        options.connect()
    ).await;

    match conn_result {
        Ok(Ok(_)) => println!("✅ SUCCESS: Connected to database!"),
        Ok(Err(e)) => println!("❌ ERROR: Connection failed: {:?}", e),
        Err(_) => println!("⌛ TIMEOUT: 30s elapsed without response."),
    }
    
    Ok(())
}
