# Build stage
FROM rust:1.75-slim as builder

WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

COPY . .
RUN cargo build --release --bin poker-backend

# Production stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/app
COPY --from=builder /usr/src/app/target/release/poker-backend .
COPY --from=builder /usr/src/app/scripts ./scripts

EXPOSE 8080

CMD ["./poker-backend"]
