use std::sync::Arc;
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    println!("Connecting to database (establishing cloud pool)...");

    let db = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(120))
        .connect(&database_url)
        .await?;

    println!("Running migrations...");
    sqlx::migrate!("./migrations")
        .run(&db)
        .await?;

    println!("Migrations completed successfully!");
    Ok(())
}
