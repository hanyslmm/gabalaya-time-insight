# Phase 3 Testing Guide: Manager Interface - Gamified Points System

## ✅ Prerequisites (Already Done)

1. ✅ Database migration applied (`20250127000000_champions_points_system.sql`)
2. ✅ Points system enabled for El Gabalaya organization
3. ✅ Points catalog seeded with default items

## 🧪 Testing Steps

### Step 1: Verify Points System is Active

1. Go to **Company Settings** page
2. Scroll to **"Champions Points System"** section
3. Verify the toggle is **ON** (enabled)
4. Check that you see:
   - Point Value: 5 EGP (or your configured value)
   - Points Budget: Your current budget
   - Points Catalog section with rewards and penalties

### Step 2: Test Points Badges on Active Employees

**Note:** The gamified badges will appear on active employee cards. Currently, `EmployeeStatusCard` is used in:
- Clock In/Out page (team status section)
- Any other pages that display active employees

**To see the badges:**

1. **As Admin/Owner**, go to **Clock In/Out** page
2. Have at least one employee clocked in (or clock someone in manually)
3. Look for the **"Team Status"** section
4. You should see:
   - Employee name
   - **Points badge** next to the name (if points system is active)
   - Badge colors:
     - 🏆 Gold (100+ points) - Legend
     - 🥇 Silver (50+ points) - Champion  
     - ⭐ Bronze (25+ points) - Rising Star
     - 🎯 Blue (0-24 points) - Starter
   - Level text below the badge

**If badges don't appear:**
- Check browser console for errors
- Verify employee has `employee_id` set (not null)
- Verify points system is enabled for the organization

### Step 3: Test Points Adjustment Dialog

1. **As Admin/Owner**, go to **Clock In/Out** page
2. Find an active employee in the **Team Status** section
3. Look for the **"Points"** button (Trophy icon) next to the employee
4. Click the **"Points"** button
5. The **Points Adjustment Dialog** should open

**Test the Dialog:**

#### Test 3a: Award Points from Catalog
1. Select an **occurrence date** (mandatory)
2. Click on a **Reward** card (e.g., "Emergency Shift +5")
3. Optionally add notes
4. Click **"Award +5 Points"**
5. Verify:
   - Success toast appears
   - Budget decreases by 5 points
   - Employee's points increase
   - Badge updates (if visible)

#### Test 3b: Deduct Points (Penalty)
1. Open dialog again
2. Select occurrence date
3. Click on a **Penalty** card (e.g., "Late > 15m -4")
4. Click **"Award -4 Points"**
5. Verify:
   - Success toast appears
   - Budget does NOT increase (penalties don't refund)
   - Employee's points decrease
   - Badge updates

#### Test 3c: Custom Reason
1. Open dialog
2. Toggle **"Use Custom Reason"** button
3. Enter:
   - Reason: "Special bonus"
   - Points: "10"
   - Date: Today
4. Submit
5. Verify it works

#### Test 3d: Budget Validation
1. Set budget to a low number (e.g., 3 points) in Company Settings
2. Try to award 5 points
3. Should see error: "Insufficient budget. Available: 3 points, Required: 5 points"
4. Try awarding 2 points - should work

### Step 4: Verify Points Log

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this query:
```sql
SELECT 
  epl.*,
  e.full_name as employee_name,
  au.username as awarded_by
FROM employee_points_log epl
JOIN employees e ON epl.employee_id = e.id
LEFT JOIN admin_users au ON epl.created_by = au.id
ORDER BY epl.created_at DESC
LIMIT 10;
```

3. Verify:
   - Points transactions are logged
   - Employee IDs are correct
   - Created_by shows who awarded points
   - Occurrence dates are correct

### Step 5: Test Helper Functions

Run these in Supabase SQL Editor:

```sql
-- Get employee total points (replace with actual employee_id)
SELECT public.get_employee_total_points('EMPLOYEE_UUID_HERE'::uuid);

-- Get employee level
SELECT public.get_employee_level('EMPLOYEE_UUID_HERE'::uuid);

-- Get employee bonus in EGP
SELECT public.get_employee_points_bonus_egp('EMPLOYEE_UUID_HERE'::uuid);

-- Get organization budget
SELECT public.get_organization_points_budget('ORGANIZATION_UUID_HERE'::uuid);
```

## 🐛 Troubleshooting

### Badges Not Showing

**Possible causes:**
1. Points system not enabled for organization
2. Employee doesn't have `employee_id` set
3. Component not receiving `employee_id` prop

**Fix:**
- Check organization settings: `SELECT is_points_system_active FROM organizations WHERE id = 'YOUR_ORG_ID';`
- Check employee: `SELECT id, full_name, staff_id FROM employees WHERE full_name = 'EMPLOYEE_NAME';`
- Check browser console for errors

### Points Button Not Appearing

**Possible causes:**
1. User is not admin/owner
2. Points system not active
3. Employee not active (clocked out)

**Fix:**
- Verify user role: Check `user.role` in browser console
- Verify points system is active
- Make sure employee is clocked in

### Dialog Errors

**Common errors:**
- "Insufficient budget" - Normal validation, top up budget
- "Please select occurrence date" - Date picker required
- "Points value must be non-zero" - Custom points validation

## 📝 Test Checklist

- [ ] Points system enabled in Company Settings
- [ ] Points badges appear on active employee cards
- [ ] Badge colors match points tiers
- [ ] Points button (Trophy icon) appears for admins
- [ ] Points Adjustment Dialog opens
- [ ] Can award points from catalog (rewards)
- [ ] Can deduct points from catalog (penalties)
- [ ] Can use custom reason
- [ ] Budget validation works (prevents over-budget awards)
- [ ] Budget decreases when awarding positive points
- [ ] Budget does NOT increase when deducting points
- [ ] Points log entries are created correctly
- [ ] Helper functions return correct values

## 🎯 Expected Behavior

1. **Badges**: Color-coded, show points and level
2. **Dialog**: Modern card-based UI, easy to use
3. **Validation**: Prevents invalid operations
4. **Budget**: Real-time updates, proper validation
5. **Logging**: All transactions recorded with full details

## 🚀 Next Steps After Testing

Once Phase 3 is verified working:
- Proceed to Phase 4: Employee Dashboard (gamified points card)
- Or report any issues found during testing

