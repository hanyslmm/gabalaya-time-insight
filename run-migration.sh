#!/bin/bash

# Employee Lifecycle Migration Script
# Run this to add status fields to employees table

echo "🚀 Running Employee Lifecycle Migration..."
echo ""

# Read the SQL file
SQL_FILE="database_migrations/001_add_employee_lifecycle_fields.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Error: Migration file not found: $SQL_FILE"
    exit 1
fi

echo "📄 Migration file: $SQL_FILE"
echo "🔗 Supabase URL: https://npmniesphobtsoftczeh.supabase.co"
echo ""

# Note: This requires service_role key (not anon key) for schema modifications
echo "⚠️  MANUAL STEP REQUIRED:"
echo ""
echo "This migration needs to be run with service_role permissions."
echo "Please follow these steps:"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/npmniesphobtsoftczeh/sql"
echo "2. Click 'New Query'"
echo "3. Copy and paste the contents of: $SQL_FILE"
echo "4. Click 'Run'"
echo ""
echo "Or use Supabase CLI with proper authentication:"
echo "   supabase link --project-ref npmniesphobtsoftczeh"
echo "   supabase db push"
echo ""
echo "📋 Migration Preview:"
echo "-------------------"
cat "$SQL_FILE"
echo "-------------------"
echo ""
echo "After running the migration, come back and continue implementation!"
