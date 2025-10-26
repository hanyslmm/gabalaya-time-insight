# Apply Promote Employee to Admin Migration

## Steps to Apply the Migration

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Open the file: `supabase/migrations/20251026000001_add_promote_employee_to_admin_function.sql`
4. Copy the entire content
5. Paste it into the SQL Editor
6. Click **Run** to execute the migration

### Option 2: Using Supabase CLI

```bash
cd supabase
npx supabase db push
```

### What This Migration Does

This migration creates a new database function `promote_employee_to_admin` that:
- Creates or updates admin_users entries with proper permissions
- Bypasses RLS policies using SECURITY DEFINER
- Updates both admin_users and employees tables
- Sets a default password that should be changed on first login

### After Applying the Migration

1. **Refresh the Employees page** in your app
2. **Edit Maha Khalil (EMP122037)**  
3. **Change her role to "admin"**
4. **Save the changes**
5. The promotion should now work without RLS errors!

### Note

The new admin user will have a default password. They should change it on first login for security.

