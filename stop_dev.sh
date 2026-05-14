#!/bin/bash

# Stop ED Triage Trainer local Vite server

echo "Stopping ED Triage Trainer frontend..."

if [ -f logs/vite.pid ]; then
  VITE_PID=$(cat logs/vite.pid)
  kill -9 "$VITE_PID" 2>/dev/null || true
  rm logs/vite.pid
fi

if command -v lsof >/dev/null 2>&1; then
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi

echo "Frontend stopped."
