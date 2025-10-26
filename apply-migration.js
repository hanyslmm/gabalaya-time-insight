const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://npmniesphobtsoftczeh.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbW5pZXNwaG9idHNvZnRjemVoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDE5NjA1NywiZXhwIjoyMDQ1NzcyMDU3fQ.KNcxTBzNR94gvzvIRGSbE0Pw4tG7X1RYxTh_c7gWP5c';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    const sqlPath = path.join(__dirname, 'supabase/migrations/20251026000001_add_promote_employee_to_admin_function.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Applying migration...');
    console.log('SQL length:', sql.length);
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error applying migration:', error);
      process.exit(1);
    }
    
    console.log('✅ Migration applied successfully!');
    console.log('Result:', data);
    process.exit(0);
  } catch (err) {
    console.error('Exception:', err);
    process.exit(1);
  }
}

applyMigration();

