#!/bin/bash

# Check accounts in database
# Usage: ./scripts/check-accounts.sh [user_id]

DB_PATH="./data/botvpn.db"

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at: $DB_PATH"
    exit 1
fi

echo "📊 Checking accounts in database..."
echo ""

if [ -n "$1" ]; then
    echo "🔍 Filtering by owner_user_id: $1"
    sqlite3 "$DB_PATH" <<EOF
.mode table
.headers on
SELECT id, username, protocol, server, status, 
       datetime(created_at) as created, 
       datetime(expired_at) as expired,
       owner_user_id
FROM accounts 
WHERE owner_user_id = $1
ORDER BY created_at DESC;
EOF
else
    echo "📋 All accounts:"
    sqlite3 "$DB_PATH" <<EOF
.mode table
.headers on
SELECT id, username, protocol, server, status, 
       datetime(created_at) as created, 
       datetime(expired_at) as expired,
       owner_user_id
FROM accounts 
ORDER BY created_at DESC 
LIMIT 20;
EOF
fi

echo ""
echo "📈 Account statistics:"
sqlite3 "$DB_PATH" <<EOF
.mode table
.headers on
SELECT 
    protocol,
    status,
    COUNT(*) as count
FROM accounts
GROUP BY protocol, status
ORDER BY protocol, status;
EOF

echo ""
echo "💡 Tip: Run './scripts/check-accounts.sh <user_id>' to filter by user"
