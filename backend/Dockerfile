# Build stage
FROM rust:1.75-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY . .

# Run the build
RUN cargo build --release

# Production stage
FROM debian:bookworm-slim

# Install runtime dependencies (OpenSSL is needed for SQLx)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/app
# Copy only the compiled binary
COPY --from=builder /usr/src/app/target/release/poker-backend ./poker-backend
COPY --from=builder /usr/src/app/scripts ./scripts

EXPOSE 8080

# Run the app
CMD ["./poker-backend"]
