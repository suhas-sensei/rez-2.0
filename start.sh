#!/bin/bash

# Start the Python backend server in background
echo "Starting Python backend on port 8000..."
cd /app && python -m src.server &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 3

# Start the Next.js frontend
echo "Starting Next.js frontend on port 3000..."
cd /app/frontend && npm start &
FRONTEND_PID=$!

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
