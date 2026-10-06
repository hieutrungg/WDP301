#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
mongosh --file create_empty_db.js
mongosh --file create_indexes.js
echo "[OK] Empty database is ready. No seed documents were inserted."
