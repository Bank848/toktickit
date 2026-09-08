#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npx playwright test e2e/lab-03
echo "--- artifacts/lab-03/screenshots contents ---"
find artifacts/lab-03/screenshots -type f -name '*.png' | sort
