#!/bin/bash

# Read the SQL file
SQL_CONTENT=$(cat supabase/migrations/20251026000001_add_promote_employee_to_admin_function.sql)

# Execute using Supabase Management API
curl -X POST \
  'https://npmniesphobtsoftczeh.supabase.co/rest/v1/rpc/exec' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbW5pZXNwaG9idHNvZnRjemVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAxOTYwNTcsImV4cCI6MjA0NTc3MjA1N30.k7n3BwEm3B-FfXO-8FX8AojGCcL_noxNKqVCFpZ5eAE" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbW5pZXNwaG9idHNvZnRjemVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAxOTYwNTcsImV4cCI6MjA0NTc3MjA1N30.k7n3BwEm3B-FfXO-8FX8AojGCcL_noxNKqVCFpZ5eAE" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"sql\": $(echo "$SQL_CONTENT" | jq -Rs .)}"

