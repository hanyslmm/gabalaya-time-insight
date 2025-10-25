# How to Apply the Admin Full CRUD Migration

## Quick Steps

### Method 1: Supabase Dashboard (Recommended - 2 minutes)

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/npmniesphobtsoftczeh/sql
   - Click "New Query"

2. **Copy Migration Content**
   - Open the file: `supabase/migrations/20250126000000_admin_full_crud_org_scoped.sql`
   - Select ALL content (Cmd+A / Ctrl+A)
   - Copy (Cmd+C / Ctrl+C)

3. **Paste and Run**
   - Paste into the SQL Editor
   - Click the **"RUN"** button
   - Wait for "Success" message (should take 2-5 seconds)

4. **Verify**
   - You should see a success message
   - The query should create 4 functions and update policies on 9 tables

5. **Refresh Your App**
   - Go back to http://localhost:8080
   - **Hard refresh** the page (Cmd+Shift+R or Ctrl+Shift+R)
   - Or logout and login again as marwa_user

### Method 2: Using Terminal (If you have psql)

```bash
# If you have the database password, run:
psql "postgresql://postgres.npmniesphobtsoftczeh:[YOUR_PASSWORD]@aws-0-eu-north-1.pooler.supabase.com:6543/postgres" -f supabase/migrations/20250126000000_admin_full_crud_org_scoped.sql
```

## What to Expect After Migration

### As Admin User (marwa_user):

1. **Navigation Menu** will now show:
   - ✅ Dashboard (if restricted before)
   - ✅ Clock In/Out
   - ✅ My Timesheet
   - ✅ Employees (Staff) - Full CRUD access
   - ✅ Timesheets (Reports) - Full CRUD access
   - ✅ Settings - Can modify organization settings
   - ✅ Profile

2. **New Capabilities**:
   - Create/Edit/Delete employees in your organization
   - Manage all timesheets in your organization
   - Approve timesheet change requests
   - Configure wage settings and company settings
   - Manage user accounts in your organization

3. **Restrictions** (Security):
   - Cannot see data from other organizations
   - Cannot create new organizations (owners only)
   - Cannot switch between organizations

## Troubleshooting

### Issue: Still can't see admin features after migration

**Solution 1: Hard Refresh**
- Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- This clears cached JavaScript

**Solution 2: Clear Cache and Re-login**
1. Logout from the app
2. Clear browser cache (or use incognito mode)
3. Login again as marwa_user
4. Check if you can now access Employees, Dashboard, etc.

**Solution 3: Verify Migration Ran Successfully**
Run this query in Supabase SQL Editor:
```sql
-- Check if helper functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_owner', 'is_admin', 'current_user_organization_id', 'is_admin_or_owner');

-- Should return 4 rows
```

### Issue: Getting permission errors

**Check RLS is enabled:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('employees', 'timesheet_entries', 'admin_users');

-- All should show rowsecurity = true
```

### Issue: Can't find migration file

The file is located at:
```
supabase/migrations/20250126000000_admin_full_crud_org_scoped.sql
```

Open it in VS Code or your code editor, then copy all content.

## Quick Test After Migration

1. Login as marwa_user
2. Click on "Employees" or "Staff" in the sidebar
3. You should see the employee list
4. Try clicking "Add Employee" - should work!
5. Try editing an employee - should work!

## Need Help?

If the migration fails or you encounter errors:
1. Take a screenshot of the error message
2. Share the error with the development team
3. We can provide a rollback script if needed

---

**Migration File**: `supabase/migrations/20250126000000_admin_full_crud_org_scoped.sql`
**Estimated Time**: 2-3 minutes
**Risk Level**: Low (can be rolled back if needed)

