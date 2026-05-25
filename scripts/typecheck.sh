#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

bash "$SCRIPT_DIR/prepare-next-types.sh"

cd "$PROJECT_ROOT"
pnpm exec tsc -p "$PROJECT_ROOT/tsconfig.typecheck.json" --noEmit --incremental false
