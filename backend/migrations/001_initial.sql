-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT,
    is_guest BOOLEAN NOT NULL DEFAULT FALSE,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    balance BIGINT NOT NULL DEFAULT 100000000000000,
    total_winnings BIGINT NOT NULL DEFAULT 0,
    total_hands_played INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tables (poker tables)
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    invite_code VARCHAR(20),
    small_blind BIGINT NOT NULL DEFAULT 10,
    big_blind BIGINT NOT NULL DEFAULT 20,
    min_buy_in BIGINT NOT NULL DEFAULT 200,
    max_buy_in BIGINT NOT NULL DEFAULT 10000,
    max_players INT NOT NULL DEFAULT 9,
    current_players INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    variant VARCHAR(50) NOT NULL DEFAULT 'texas_holdem',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hand histories for replay
CREATE TABLE IF NOT EXISTS hand_histories (
    id UUID PRIMARY KEY,
    table_id UUID NOT NULL REFERENCES tables(id),
    hand_number BIGINT NOT NULL,
    players JSONB NOT NULL DEFAULT '[]',
    community_cards JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    pot_total BIGINT NOT NULL DEFAULT 0,
    winners JSONB NOT NULL DEFAULT '[]',
    server_seed_hash VARCHAR(128) NOT NULL,
    server_seed VARCHAR(128),
    player_seeds JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transaction log
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    table_id UUID REFERENCES tables(id),
    hand_id UUID REFERENCES hand_histories(id),
    tx_type VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status);
CREATE INDEX IF NOT EXISTS idx_hand_histories_table_id ON hand_histories(table_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_total_winnings ON users(total_winnings DESC);
