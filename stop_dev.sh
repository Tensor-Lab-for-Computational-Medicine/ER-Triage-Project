#!/bin/bash

# Stop development servers

echo "Stopping development servers..."

# Kill by port
echo "Killing processes on ports 5001 and 3000..."
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Kill by PID if available
if [ -f logs/flask.pid ]; then
    FLASK_PID=$(cat logs/flask.pid)
    kill -9 $FLASK_PID 2>/dev/null
    rm logs/flask.pid
fi

if [ -f logs/react.pid ]; then
    REACT_PID=$(cat logs/react.pid)
    kill -9 $REACT_PID 2>/dev/null
    rm logs/react.pid
fi

echo "✓ Servers stopped!"

