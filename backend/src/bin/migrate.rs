use std::sync::Arc;
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    println!("Connecting to database: {}", database_url);

    let db = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    println!("Running migrations...");
    sqlx::migrate!("./migrations")
        .run(&db)
        .await?;

    println!("Migrations completed successfully!");
    Ok(())
}
