#!/bin/bash

# Test script to verify account persistence
# This script monitors logs for account persistence messages

echo "🔍 Monitoring bot logs for account persistence..."
echo "📌 Please create an account via the bot now"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Monitor logs for persist-related messages
tail -f bot.log 2>/dev/null | grep --line-buffered -E "(persist|Account persisted|Extracted data|Skipping trial|Failed to persist)" &
TAIL_PID=$!

echo "Press Ctrl+C to stop monitoring"
echo ""

# Trap Ctrl+C to cleanup
trap "kill $TAIL_PID 2>/dev/null; echo ''; echo '✅ Monitoring stopped'; exit 0" INT

wait $TAIL_PID
