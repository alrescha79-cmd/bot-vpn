#!/bin/bash

# Script untuk set user sebagai admin di database
# Usage: ./scripts/set-admin.sh <telegram_user_id>

if [ -z "$1" ]; then
  echo "❌ Error: User ID tidak diberikan"
  echo "Usage: ./scripts/set-admin.sh <telegram_user_id>"
  echo "Contoh: ./scripts/set-admin.sh 123456789"
  exit 1
fi

USER_ID=$1
DB_PATH="data/botvpn.db"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
  echo "❌ Database tidak ditemukan di $DB_PATH"
  echo "Pastikan bot sudah dijalankan minimal 1 kali untuk membuat database."
  exit 1
fi

# Check if user exists in database
USER_EXISTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE user_id = $USER_ID;")

if [ "$USER_EXISTS" -eq 0 ]; then
  echo "⚠️  User dengan ID $USER_ID belum terdaftar di database."
  echo "User akan otomatis terdaftar saat pertama kali mengirim /start ke bot."
  echo ""
  echo "Apakah Anda ingin menambahkan user ini ke database sekarang? (y/n)"
  read -r response
  
  if [[ "$response" == "y" || "$response" == "Y" ]]; then
    sqlite3 "$DB_PATH" "INSERT INTO users (user_id, username, saldo, role) VALUES ($USER_ID, 'admin', 0, 'admin');"
    echo "✅ User $USER_ID berhasil ditambahkan sebagai admin!"
  else
    echo "❌ Dibatalkan."
    exit 1
  fi
else
  # Update existing user to admin
  sqlite3 "$DB_PATH" "UPDATE users SET role = 'admin' WHERE user_id = $USER_ID;"
  echo "✅ User $USER_ID berhasil di-set sebagai admin!"
fi

# Show current admin info
echo ""
echo "📋 Info Admin:"
sqlite3 -header -column "$DB_PATH" "SELECT user_id, username, role, saldo FROM users WHERE user_id = $USER_ID;"

echo ""
echo "✅ Selesai! Silakan restart bot untuk menerapkan perubahan."
