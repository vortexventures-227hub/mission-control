#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NEXT_TYPES_DIR="$PROJECT_ROOT/.next/types"
STABLE_TYPES_DIR="$PROJECT_ROOT/.typecheck/next-types"
CACHE_LIFE_TYPES_FILE="$STABLE_TYPES_DIR/cache-life.d.ts"

rm -rf "$PROJECT_ROOT/.next/dev/types" "$STABLE_TYPES_DIR"

cd "$PROJECT_ROOT"
pnpm exec next typegen

mkdir -p "$STABLE_TYPES_DIR"
cp "$NEXT_TYPES_DIR/routes.d.ts" "$STABLE_TYPES_DIR/routes.d.ts"
cp "$NEXT_TYPES_DIR/validator.ts" "$STABLE_TYPES_DIR/validator.ts"

printf 'export {}\n' > "$CACHE_LIFE_TYPES_FILE"
