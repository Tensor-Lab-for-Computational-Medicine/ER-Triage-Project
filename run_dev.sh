#!/bin/bash

# ER Triage Simulation - Development Server Launcher
# Starts both Flask backend and React frontend

echo "Starting ER Triage Simulation Development Servers..."
echo "=================================================="

# Kill any existing processes on ports 5001 and 3000
echo "Cleaning up existing processes..."
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1

# Check if virtual environment exists
if [ -d "tensor_lab_env" ]; then
    echo "Activating virtual environment..."
    source tensor_lab_env/bin/activate
fi

# Create log directory
mkdir -p logs

# Start Flask backend on port 5001
echo ""
echo "Starting Flask backend on http://localhost:5001..."
nohup python app.py > logs/flask.log 2>&1 &
FLASK_PID=$!
echo "Flask PID: $FLASK_PID"

# Wait for Flask to start
echo "Waiting for Flask to start..."
for i in {1..10}; do
    if lsof -ti:5001 > /dev/null 2>&1; then
        echo "✓ Flask backend started successfully!"
        break
    fi
    if [ $i -eq 10 ]; then
        echo ""
        echo "ERROR: Flask backend failed to start!"
        echo "Check logs/flask.log for details:"
        cat logs/flask.log
        exit 1
    fi
    sleep 1
done

# Start React frontend on port 3000 (disable auto-open)
echo ""
echo "Starting React frontend on http://localhost:3000..."
cd frontend
BROWSER=none nohup npm start > ../logs/react.log 2>&1 &
REACT_PID=$!
cd ..
echo "React PID: $REACT_PID"

# Wait a bit for React to start
echo "Waiting for React to start..."
sleep 3

echo ""
echo "=================================================="
echo "✓ Both servers are running!"
echo ""
echo "Flask Backend:  http://localhost:5001"
echo "React Frontend: http://localhost:3000"
echo ""
echo "Logs:"
echo "  Flask:  logs/flask.log"
echo "  React:  logs/react.log"
echo ""
echo "To view logs:"
echo "  tail -f logs/flask.log"
echo "  tail -f logs/react.log"
echo ""
echo "To stop servers:"
echo "  kill $FLASK_PID $REACT_PID"
echo "  OR run: ./stop_dev.sh"
echo "=================================================="
echo ""
echo "Opening browser in 2 seconds..."
sleep 2

# Open browser once (works on macOS)
if command -v open > /dev/null; then
    open http://localhost:3000
elif command -v xdg-open > /dev/null; then
    xdg-open http://localhost:3000
fi

echo ""
echo "Servers are running in the background."
echo "Press Ctrl+C to exit this script (servers will keep running)."
echo "Use './stop_dev.sh' to stop the servers."

# Save PIDs to file for stop script
echo "$FLASK_PID" > logs/flask.pid
echo "$REACT_PID" > logs/react.pid

# Wait for user to press Ctrl+C
trap "echo '\nScript exited. Servers are still running. Use ./stop_dev.sh to stop them.'; exit 0" INT TERM

# Keep script running
while true; do
    # Check if servers are still running
    if ! kill -0 $FLASK_PID 2>/dev/null; then
        echo "Flask backend stopped unexpectedly!"
        cat logs/flask.log
        exit 1
    fi
    if ! kill -0 $REACT_PID 2>/dev/null; then
        echo "React frontend stopped unexpectedly!"
        cat logs/react.log
        exit 1
    fi
    sleep 5
done
