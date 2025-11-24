#!/bin/bash

# Migration script: Move botvpn.db from root to data/ folder
# Run this ONCE after updating to version with data/ folder

echo "🔄 Database Migration Script"
echo "=============================="
echo ""

OLD_DB="./botvpn.db"
NEW_DB="./data/botvpn.db"
BACKUP_DB="./botvpn.db.backup-$(date +%Y%m%d-%H%M%S)"

# Check if old database exists in root
if [ -f "$OLD_DB" ]; then
    echo "📦 Found old database: $OLD_DB"
    
    # Create data directory if not exists
    mkdir -p ./data
    echo "✅ Created ./data/ folder"
    
    # Check if new database already exists
    if [ -f "$NEW_DB" ]; then
        echo "⚠️  WARNING: $NEW_DB already exists!"
        read -p "   Do you want to OVERWRITE it with $OLD_DB? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Migration cancelled."
            exit 1
        fi
    fi
    
    # Create backup of old database
    echo "💾 Creating backup: $BACKUP_DB"
    cp "$OLD_DB" "$BACKUP_DB"
    echo "✅ Backup created"
    
    # Move database to data folder
    echo "🚀 Moving database to data/ folder..."
    mv "$OLD_DB" "$NEW_DB"
    echo "✅ Database moved successfully"
    
    echo ""
    echo "════════════════════════════════════════"
    echo "✅ MIGRATION COMPLETE"
    echo "════════════════════════════════════════"
    echo ""
    echo "Database location:"
    echo "  • Old: $OLD_DB (removed)"
    echo "  • New: $NEW_DB"
    echo "  • Backup: $BACKUP_DB"
    echo ""
    echo "You can now start the application."
    echo "To remove backup: rm $BACKUP_DB"
    
else
    echo "ℹ️  No old database found at $OLD_DB"
    echo "   Either:"
    echo "   • This is a fresh installation (OK)"
    echo "   • Database already migrated (OK)"
    echo "   • Database in different location"
    echo ""
    
    if [ -f "$NEW_DB" ]; then
        echo "✅ Database exists at correct location: $NEW_DB"
    else
        echo "ℹ️  Database will be created automatically on first run at: $NEW_DB"
    fi
fi

echo ""
echo "Done."
