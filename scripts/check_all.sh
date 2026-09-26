#!/usr/bin/env bash
# One green/red verdict before opening a PR: runs every check, cheapest
# first, and stops at the first failure so the output ends on the problem.
set -euo pipefail
cd "$(dirname "$0")/.."

run() {
  echo
  echo "=== $1"
  shift
  "$@"
}

run "pytest"               poetry run pytest -q
run "JS unit tests"        node --test 'tests/js/*.test.mjs'
run "UI text snapshot"     poetry run python scripts/ui_text_snapshot.py --check
run "render fingerprint"   poetry run python scripts/render_fingerprint.py --check
run "e2e smoke"            poetry run python scripts/e2e_smoke.py
run "perf transitions"     poetry run python scripts/perf_transitions.py

echo
echo "ALL CHECKS PASSED"
