# 🔧 FIX: Admin Can't See Other Employees' Data

## 🎯 Problem

**Symptom:**
- marwa_user (admin) can see their own timesheet data
- BUT cannot see other employees' timesheets (like Maryam's)
- Reports page shows only marwa_user's data
- Timesheets page shows only marwa_user's entries

**Root Cause:**
- Other employees' timesheet entries don't have `organization_id` set
- OR they have a different `organization_id` than Science Club
- RLS policies filter by organization, so unassigned data is invisible to admins

## ✅ Solution (2 minutes)

### Step 1: Run This SQL

Open Supabase SQL Editor and run:

**File:** `FIX_ADMIN_VIEW_ALL_DATA.sql`

Or copy this:

```sql
-- Assign ALL employees and timesheets to Science Club
DO $$
DECLARE
  science_club_id UUID;
BEGIN
  -- Get Science Club ID
  SELECT id INTO science_club_id FROM organizations WHERE name = 'Science Club';
  
  IF science_club_id IS NULL THEN
    INSERT INTO organizations (name) VALUES ('Science Club') RETURNING id INTO science_club_id;
  END IF;
  
  -- Update ALL employees to Science Club
  UPDATE employees
  SET organization_id = science_club_id, updated_at = NOW()
  WHERE organization_id IS NULL OR organization_id != science_club_id;
  
  -- Update ALL timesheet entries to Science Club
  UPDATE timesheet_entries
  SET organization_id = science_club_id, updated_at = NOW()
  WHERE organization_id IS NULL OR organization_id != science_club_id;
  
  -- Update settings
  UPDATE wage_settings SET organization_id = science_club_id WHERE organization_id IS NULL;
  UPDATE company_settings SET organization_id = science_club_id WHERE organization_id IS NULL;
  
  -- Ensure marwa_user is assigned correctly
  UPDATE admin_users
  SET organization_id = science_club_id, current_organization_id = science_club_id
  WHERE username = 'marwa_user';
  
  RAISE NOTICE '✅ All data assigned to Science Club';
END $$;

-- Verify
SELECT 
  o.name as organization,
  (SELECT COUNT(*) FROM employees WHERE organization_id = o.id) as employees,
  (SELECT COUNT(*) FROM timesheet_entries WHERE organization_id = o.id) as timesheets
FROM organizations o
WHERE o.name = 'Science Club';
```

**Expected Output:**
```
✅ All data assigned to Science Club

organization  | employees | timesheets
Science Club  |     X     |     Y
```

### Step 2: Logout & Login (REQUIRED!)

**CRITICAL:** You must refresh your session!

1. Go to http://localhost:8080
2. Click **Logout**
3. **Hard refresh**: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)
4. **Login** as marwa_user / marwa123

### Step 3: Verify Fix

After login, check:

#### ✅ Reports Page:
- Should show **ALL employees** (not just marwa_user)
- Total hours should include everyone
- Employee count should show all employees

#### ✅ Timesheets Page:
- Should show **ALL timesheet entries** from all employees
- Can filter by employee (Maryam should appear)
- Can search and see everyone's data

#### ✅ Employees Page:
- Shows all employees in Science Club
- Can view/edit all employee records

---

## 🔍 Why This Happened

### The Issue:
When you first ran the migration, some data had:
- `organization_id = NULL` 
- Or `organization_id` pointing to a different organization

### How RLS Works:
```sql
-- Admin policy checks:
is_admin() AND organization_id = current_user_organization_id()
```

This means:
- ✅ marwa_user is admin ✓
- ✅ marwa_user.organization_id = Science Club ✓
- ❌ Some timesheets had organization_id = NULL or different org
- Result: Those timesheets were filtered out

### The Fix:
Assigns **ALL** data to Science Club so admins can see everything.

---

## 📊 Expected Final State

### Before Fix:
```
Reports Page:
  Employees: 1 (only marwa_user)
  Timesheets: X (only marwa_user's)
  
Timesheets Page:
  Only shows marwa_user entries
```

### After Fix:
```
Reports Page:
  Employees: 10+ (all employees including Maryam)
  Timesheets: 100+ (everyone's timesheets)
  Total Hours: includes all employees
  
Timesheets Page:
  Shows ALL entries from:
    - marwa_user
    - Maryam
    - admintest2
    - All other employees
```

---

## 🐛 Troubleshooting

### Still can't see other employees?

**Run diagnostic:**

```sql
-- Check if data is assigned
SELECT 
  employee_name,
  COUNT(*) as entries,
  organization_id,
  (SELECT name FROM organizations WHERE id = organization_id) as org
FROM timesheet_entries
GROUP BY employee_name, organization_id
ORDER BY employee_name;
```

If `org` is NULL or different from "Science Club", run Step 1 again.

### Can see in database but not in app?

**Must logout/login** to refresh JWT token!

The RLS policies use the JWT token which contains:
- username
- role
- **organization_id** ← This must be current!

Without logout/login, old token still has old org info.

---

## ✅ Quick Summary

**Problem:** Admin can't see other employees' data
**Cause:** Data not assigned to admin's organization
**Fix:** Assign all data to Science Club + Logout/Login
**Time:** 2 minutes
**Difficulty:** Copy-paste SQL

---

## 📁 Files Created

1. **`FIX_ADMIN_VIEW_ALL_DATA.sql`** - Complete fix with verification
2. **`diagnose_admin_visibility.sql`** - Diagnostic queries
3. **This guide** - Instructions and troubleshooting

---

**Run the fix now and let me know if all employees' data appears!** 🚀

