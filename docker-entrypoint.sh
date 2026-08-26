#!/bin/sh
set -e

# --- Source .env if present ---
if [ -f /app/.env ]; then
  printf '[entrypoint] Loading .env\n'
  set -a
  . /app/.env
  set +a
fi

# --- Helper: generate a random hex secret ---
generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

SECRETS_FILE="/app/.data/.generated-secrets"

# Ensure secrets file has restrictive permissions if it exists
if [ -f "$SECRETS_FILE" ]; then
  chmod 600 "$SECRETS_FILE"
fi

# Load previously generated secrets if they exist
if [ -f "$SECRETS_FILE" ]; then
  printf '[entrypoint] Loading persisted secrets from .data\n'
  set -a
  . "$SECRETS_FILE"
  set +a
fi

# --- AUTH_SECRET ---
if [ -z "$AUTH_SECRET" ] || [ "$AUTH_SECRET" = "random-secret-for-legacy-cookies" ]; then
  AUTH_SECRET=$(generate_secret)
  printf '[entrypoint] Generated new AUTH_SECRET\n'
  printf 'AUTH_SECRET=%s\n' "$AUTH_SECRET" >> "$SECRETS_FILE"
  export AUTH_SECRET
fi

# --- API_KEY ---
if [ -z "$API_KEY" ] || [ "$API_KEY" = "generate-a-random-key" ]; then
  API_KEY=$(generate_secret)
  printf '[entrypoint] Generated new API_KEY\n'
  printf 'API_KEY=%s\n' "$API_KEY" >> "$SECRETS_FILE"
  export API_KEY
fi

# --- OpenClaw gateway -------------------------------------------------------
# MC reaches the gateway by spawning `openclaw gateway call`, which talks to a
# gateway on this host. Bind LOOPBACK and auth none on purpose: the gateway is
# reachable only from inside this container. Fly publishes just the HTTP port,
# and loopback keeps it off the .internal private network too, so there is no
# unauthenticated control plane exposed to anything.
if command -v openclaw >/dev/null 2>&1; then
  mkdir -p "${OPENCLAW_HOME:-/app/.data/openclaw}"
  printf '[entrypoint] Starting OpenClaw gateway (loopback)\n'
  openclaw gateway run --bind loopback --auth none --allow-unconfigured \
    >>"${OPENCLAW_HOME:-/app/.data/openclaw}/gateway.log" 2>&1 &
  # FAIL OPEN. This probe previously ran with no timeout at all, so a gateway
  # that never answered blocked the entrypoint forever and `exec node server.js`
  # was never reached — the app never bound :3000 and Fly served 502 while the
  # container looked alive. An optional dependency must never gate the HTTP
  # server starting.
  #
  # Two independent bounds: --timeout on the CLI, and `timeout` around it in
  # case the CLI itself fails to honour its own flag. Total wait is capped, and
  # the server starts regardless of the outcome. /api/status reports real
  # gateway responsiveness, so degraded-but-serving is visible rather than silent.
  gateway_ready=no
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if timeout 4 openclaw gateway health --timeout 3000 >/dev/null 2>&1; then
      gateway_ready=yes; break
    fi
    sleep 1
  done
  if [ "$gateway_ready" = yes ]; then
    printf '[entrypoint] Gateway healthy\n'
  else
    printf '[entrypoint] WARN gateway did not report healthy; starting server anyway (degraded)\n'
  fi
else
  printf '[entrypoint] WARN openclaw not installed; session control will fail\n'
fi

printf '[entrypoint] Starting server\n'
exec node server.js
