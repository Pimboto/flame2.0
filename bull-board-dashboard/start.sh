#!/bin/bash

# Bull Board Dashboard Startup Script

echo "🚀 Starting Bull Board Dashboard..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from example..."
    cp env.example .env
    echo "✅ .env file created. Please edit it with your Redis configuration."
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the dashboard
echo "🎯 Starting Bull Board Dashboard..."
npm start 
