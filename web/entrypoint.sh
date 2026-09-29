#!/bin/sh
set -e

SSL_DIR="/etc/nginx/ssl"
CUSTOM_DIR="/etc/nginx/certs"
mkdir -p "$SSL_DIR"

# 1. Detect user-supplied certificates or generate auto self-signed cert
if [ -f "$CUSTOM_DIR/fullchain.pem" ] && [ -f "$CUSTOM_DIR/privkey.pem" ]; then
    echo "[ORCA-WEB] Found user SSL certificate (fullchain.pem, privkey.pem)."
    cp "$CUSTOM_DIR/fullchain.pem" "$SSL_DIR/tls.crt"
    cp "$CUSTOM_DIR/privkey.pem" "$SSL_DIR/tls.key"
elif [ -f "$CUSTOM_DIR/tls.crt" ] && [ -f "$CUSTOM_DIR/tls.key" ]; then
    echo "[ORCA-WEB] Found user SSL certificate (tls.crt, tls.key)."
    cp "$CUSTOM_DIR/tls.crt" "$SSL_DIR/tls.crt"
    cp "$CUSTOM_DIR/tls.key" "$SSL_DIR/tls.key"
elif [ -f "$CUSTOM_DIR/orca.crt" ] && [ -f "$CUSTOM_DIR/orca.key" ]; then
    echo "[ORCA-WEB] Found user SSL certificate (orca.crt, orca.key)."
    cp "$CUSTOM_DIR/orca.crt" "$SSL_DIR/tls.crt"
    cp "$CUSTOM_DIR/orca.key" "$SSL_DIR/tls.key"
elif [ -f "$SSL_DIR/tls.crt" ] && [ -f "$SSL_DIR/tls.key" ]; then
    echo "[ORCA-WEB] Existing SSL certificate found in $SSL_DIR."
else
    echo "[ORCA-WEB] No SSL certificate provided. Generating automatic self-signed certificate (valid for any domain/IP)..."
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$SSL_DIR/tls.key" \
        -out "$SSL_DIR/tls.crt" \
        -subj "/CN=orca.local/O=ORCA/OU=SelfHosted" \
        -addext "subjectAltName=DNS:localhost,DNS:*.local,IP:127.0.0.1,IP:0.0.0.0" 2>/dev/null || \
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$SSL_DIR/tls.key" \
        -out "$SSL_DIR/tls.crt" \
        -subj "/CN=orca.local/O=ORCA/OU=SelfHosted"
    echo "[ORCA-WEB] Self-signed SSL certificate generated successfully."
fi

# Ensure correct permissions
chmod 600 "$SSL_DIR/tls.key" 2>/dev/null || true
chmod 644 "$SSL_DIR/tls.crt" 2>/dev/null || true

# 2. Check if FORCE_SSL redirection is requested
if [ "$FORCE_SSL" = "true" ] || [ "$FORCE_HTTPS" = "true" ]; then
    echo "[ORCA-WEB] FORCE_SSL is enabled. Redirecting HTTP traffic to HTTPS."
    sed -i 's/# FORCE_SSL_REDIRECT //g' /etc/nginx/conf.d/default.conf 2>/dev/null || true
fi

echo "[ORCA-WEB] Starting Nginx (HTTP :80 & HTTPS :443)..."
exec nginx -g "daemon off;"
