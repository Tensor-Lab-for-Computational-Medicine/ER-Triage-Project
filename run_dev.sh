#!/bin/bash

# ED Triage Trainer - static frontend development server

set -e

echo "Starting ED Triage Trainer static frontend..."
echo "=================================================="

mkdir -p logs

if command -v lsof >/dev/null 2>&1; then
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi

cd frontend
BROWSER=none nohup npm run dev -- --port 3000 > ../logs/vite.log 2>&1 &
VITE_PID=$!
cd ..

echo "$VITE_PID" > logs/vite.pid
echo "Vite PID: $VITE_PID"

sleep 2

echo ""
echo "Frontend: http://localhost:3000"
echo "Logs:     logs/vite.log"
echo "Stop:     ./stop_dev.sh"
echo "=================================================="

if command -v open >/dev/null 2>&1; then
  open http://localhost:3000
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:3000
fi

trap "echo; echo 'Script exited. The Vite server is still running. Use ./stop_dev.sh to stop it.'; exit 0" INT TERM

while true; do
  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    echo "Vite server stopped unexpectedly."
    cat logs/vite.log
    exit 1
  fi
  sleep 5
done
