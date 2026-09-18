#!/usr/bin/env bash
# start.sh — Iceberg Zoom SDK POC Development Server
# Runs the Laravel backend with PHP_CLI_SERVER_WORKERS for concurrent static asset serving.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PHP_CLI_SERVER_WORKERS=8

echo ""
echo "  ┌─────────────────────────────────────────────────────────┐"
echo "  │   Iceberg Zoom SDK — POC Dev Server                    │"
echo "  │                                                         │"
echo "  │   Backend (API)     http://localhost:8000               │"
echo "  │   Meeting SDK POC   http://localhost:8000/msdk/         │"
echo "  │   Video SDK POC     http://localhost:8000/vsdk/         │"
echo "  │                                                         │"
echo "  │   Press Ctrl+C to stop.                                │"
echo "  └─────────────────────────────────────────────────────────┘"
echo ""

php artisan serve --host=0.0.0.0 --port=8000
