#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STANDALONE_DIR="$PROJECT_ROOT/.next/standalone"
STANDALONE_NEXT_DIR="$STANDALONE_DIR/.next"
STANDALONE_STATIC_DIR="$STANDALONE_NEXT_DIR/static"
SOURCE_STATIC_DIR="$PROJECT_ROOT/.next/static"
SOURCE_PUBLIC_DIR="$PROJECT_ROOT/public"
STANDALONE_PUBLIC_DIR="$STANDALONE_DIR/public"

sync_runtime_native_package_from_project() {
  local package_name="$1"
  local project_store_dir=""
  local runtime_store_dir=""

  project_store_dir="$(find "$PROJECT_ROOT/node_modules/.pnpm" -maxdepth 1 -type d -name "${package_name}@*" | head -n1)"
  runtime_store_dir="$(find "$STANDALONE_DIR/node_modules/.pnpm" -maxdepth 1 -type d -name "${package_name}@*" | head -n1)"

  [[ -n "$project_store_dir" && -n "$runtime_store_dir" ]] || return 0
  [[ -d "$project_store_dir/node_modules/$package_name/build" ]] || return 0

  rm -rf "$runtime_store_dir/node_modules/$package_name/build"
  cp -R "$project_store_dir/node_modules/$package_name/build" "$runtime_store_dir/node_modules/$package_name/build"
}

if [[ ! -f "$STANDALONE_DIR/server.js" ]]; then
  echo "error: standalone server missing at $STANDALONE_DIR/server.js" >&2
  echo "run 'pnpm build' first" >&2
  exit 1
fi

mkdir -p "$STANDALONE_NEXT_DIR"

if [[ -d "$SOURCE_STATIC_DIR" ]]; then
  rm -rf "$STANDALONE_STATIC_DIR"
  cp -R "$SOURCE_STATIC_DIR" "$STANDALONE_STATIC_DIR"
fi

if [[ -d "$SOURCE_PUBLIC_DIR" ]]; then
  rm -rf "$STANDALONE_PUBLIC_DIR"
  cp -R "$SOURCE_PUBLIC_DIR" "$STANDALONE_PUBLIC_DIR"
fi

# Rebuild native modules inside the standalone runtime so local launches
# survive Node ABI drift after installs/builds on a different Node release.
if command -v pnpm >/dev/null 2>&1 && [[ -d "$STANDALONE_DIR/node_modules" ]]; then
  pnpm --dir "$STANDALONE_DIR" rebuild better-sqlite3 node-pty >/dev/null
fi

# Next's standalone trace can omit native addon build outputs even when the
# project dependency tree has a valid local binary. Refresh those artifacts
# from the project install before launching the standalone server.
sync_runtime_native_package_from_project "better-sqlite3"
sync_runtime_native_package_from_project "node-pty"

cd "$STANDALONE_DIR"
# Next.js standalone server reads HOSTNAME to decide bind address.
# Override inherited shell hostnames so localhost and LAN access both work.
export HOSTNAME="0.0.0.0"
exec node server.js
