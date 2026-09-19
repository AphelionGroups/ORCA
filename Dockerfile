# =========================================================
# ORCA Backend Modular Monolith API - Production Dockerfile
# Multi-stage lightweight build (<25MB image footprint)
# =========================================================

# --- Stage 1: Build binary ---
FROM golang:alpine AS builder

ENV GOTOOLCHAIN=auto

WORKDIR /build

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w" \
    -o /build/bin/server ./cmd/server/main.go

# --- Stage 2: Minimal Runtime ---
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata wget \
    && addgroup -S orca && adduser -S orca -G orca

WORKDIR /app

COPY --from=builder /build/bin/server /app/server
COPY --from=builder /build/migrations /app/migrations

RUN chown -R orca:orca /app

USER orca

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/healthz || exit 1

ENTRYPOINT ["/app/server"]
