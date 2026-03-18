#!/bin/bash
# Check if .env exists
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

echo "Running migrations for $DATABASE_URL..."
cargo run --bin migrate
