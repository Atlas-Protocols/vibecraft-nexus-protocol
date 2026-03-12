#!/bin/bash

# Vibecraft Launcher
# "The Face & The Voice"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VIBECRAFT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🎨 Initializing Vibecraft..."
cd "$VIBECRAFT_ROOT" || exit 1

# Check for cleanup
if lsof -i :4002 >/dev/null 2>&1; then
    echo "⚠️  Port 4002 is assigned. Cleaning up..."
    lsof -ti :4002 | xargs kill -9
fi
if lsof -i :4003 >/dev/null 2>&1; then
    echo "⚠️  Port 4003 is assigned. Cleaning up..."
    lsof -ti :4003 | xargs kill -9
fi

echo "🚀 Launching Vite & Node Server..."
# Using 'dev' script which typically runs concurrently
npm run dev
