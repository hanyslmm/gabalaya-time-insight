# Admin Full CRUD Implementation - Organization Scoped

## Overview

This document describes the implementation of full CRUD (Create, Read, Update, Delete) privileges for users with the `admin` role, strictly scoped to their organization.

## Security Model

### Role Hierarchy

1. **Owner** (`role = 'owner'` OR `is_global_owner = TRUE`)
   - Global access to ALL organizations
   - Can create/manage organizations
   - Can manage users across all organizations
   - Platform-level administration

2. **Admin** (`role = 'admin'`)
   - Full CRUD access to their organization ONLY
   - Cannot see or modify data from other organizations
   - Same privileges as owner, but scoped to organization_id
   - Organization-level administration

3. **Employee** (default)
   - Read-only access to their own data
   - Can view timesheet entries, profile, etc.
   - Cannot modify other users' data

## Implementation Details

### Database Changes

#### Helper Functions Created

Four security definer functions were created for cleaner RLS policies:

1. `is_owner()` - Returns TRUE if current user is an owner
2. `is_admin()` - Returns TRUE if current user is an admin
3. `current_user_organization_id()` - Returns the organization_id of current user
4. `is_admin_or_owner()` - Returns TRUE if user has full CRUD privileges

#### Tables Updated with Organization-Scoped RLS Policies

1. **admin_users**
   - Owners: Full CRUD on all users
   - Admins: Full CRUD on users in their organization
   - Users: Can view/update their own profile

2. **organizations**
   - Owners: Full CRUD on all organizations
   - Admins: Can view and UPDATE their own organization (cannot create new orgs)
   - Users: Can view their organization

3. **employees**
   - Owners: Full CRUD on all employees
   - Admins: Full CRUD on employees in their organization
   - Employees: Can view their own profile

4. **timesheet_entries**
   - Owners: Full CRUD on all timesheets
   - Admins: Full CRUD on timesheets in their organization
   - Employees: Can view their own timesheets

5. **timesheet_change_requests**
   - Owners: Full CRUD on all change requests
   - Admins: Full CRUD on change requests in their organization
   - Employees: Can create/view their own requests

6. **wage_settings**
   - Owners: Full CRUD on all wage settings
   - Admins: Full CRUD on wage settings for their organization
   - Users: Can view wage settings (needed for calculations)

7. **company_settings**
   - Owners: Full CRUD on all company settings
   - Admins: Full CRUD on company settings for their organization
   - Users: Can view company settings for their organization

8. **employee_roles**
   - Owners: Full CRUD on all employee roles
   - Admins: Full CRUD on employee roles in their organization
   - Users: Can view employee roles for their organization

9. **owner_organization_access**
   - Owners only: Manage organization access
   - Not accessible to admins or employees

### Frontend Changes

#### Components Updated

1. **OrganizationManagement.tsx**
   - Now accessible to both owners and admins
   - "Create Organization" button only visible to owners
   - Admins can manage users in their organization
   - RLS policies ensure data isolation

2. **AdminRoleChange.tsx**
   - Now accessible to owners and admins
   - Admins can change roles for users in their organization
   - RLS policies prevent cross-organization modifications

#### Permission Checks

Most components already use the pattern:
```typescript
const isAdmin = user?.role === 'admin' || user?.role === 'owner';
```

This means the frontend already treats admin and owner the same in terms of UI access. The RLS policies provide the organization-scoping at the database level.

## Data Isolation & Security

### How Organization Isolation Works

1. **JWT Token**: Contains `username` and `organization_id`
2. **Helper Functions**: Use SECURITY DEFINER to safely query user info
3. **RLS Policies**: 
   - Check if user is owner (bypass org filter)
   - OR check if user is admin AND organization_id matches
4. **Frontend**: Displays all features, but database only returns org-scoped data

### Security Guarantees

✅ **Data Isolation**: Admins can NEVER see data from other organizations
✅ **Cross-Org Prevention**: All INSERT/UPDATE operations validate organization_id
✅ **Consistent Enforcement**: RLS policies applied at database level (can't be bypassed)
✅ **Audit Trail**: All modifications tracked with updated_at timestamps

## Testing Checklist

### Test Scenarios for Admin Role

#### 1. Employee Management
- [ ] Admin can view all employees in their organization
- [ ] Admin cannot see employees from other organizations
- [ ] Admin can create new employees in their organization
- [ ] Admin cannot create employees in other organizations
- [ ] Admin can update employees in their organization
- [ ] Admin cannot update employees from other organizations
- [ ] Admin can delete employees in their organization
- [ ] Admin cannot delete employees from other organizations

#### 2. Timesheet Management
- [ ] Admin can view all timesheets in their organization
- [ ] Admin cannot see timesheets from other organizations
- [ ] Admin can create timesheets for employees in their organization
- [ ] Admin can update timesheets in their organization
- [ ] Admin can delete timesheets in their organization

#### 3. Settings Management
- [ ] Admin can view wage settings for their organization
- [ ] Admin can update wage settings for their organization
- [ ] Admin can view company settings for their organization
- [ ] Admin can update company settings for their organization

#### 4. User Management
- [ ] Admin can view all users in their organization
- [ ] Admin can create new users in their organization
- [ ] Admin can update users in their organization (including role changes)
- [ ] Admin can delete users in their organization
- [ ] Admin cannot manage users from other organizations

#### 5. Organization Management
- [ ] Admin can view their own organization
- [ ] Admin can update their organization details
- [ ] Admin cannot create new organizations
- [ ] Admin cannot view other organizations

### Test Scenarios for Owner Role

All admin capabilities PLUS:
- [ ] Owner can see ALL organizations
- [ ] Owner can create new organizations
- [ ] Owner can manage users across ALL organizations
- [ ] Owner can switch between organizations
- [ ] Owner has global access to all data

## Migration Instructions

### Prerequisites

1. Ensure all existing data has `organization_id` set
2. Backup database before running migration
3. Test in development environment first

### Running the Migration

```bash
# Run the migration
supabase db push

# Or manually via psql
psql -h [host] -U [user] -d [database] -f supabase/migrations/20250126000000_admin_full_crud_org_scoped.sql
```

### Verification Queries

```sql
-- Test as admin user (should only see their org)
SELECT * FROM employees;

-- Test as owner (should see all orgs)
SELECT * FROM employees;

-- Verify RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('employees', 'timesheet_entries', 'admin_users', 'organizations');
```

## Rollback Plan

If issues occur, the migration can be rolled back by:

1. **Drop the new policies**:
```sql
-- Drop all policies created by this migration
-- (List them explicitly or use pattern matching)
```

2. **Restore previous policies**:
```sql
-- Restore the permissive policies
CREATE POLICY "Allow authenticated access" ON [table] FOR ALL USING (true);
```

3. **Verify data integrity**:
```sql
-- Check that no data was modified
SELECT COUNT(*) FROM [tables];
```

## Benefits

### For Organization Admins
✅ Full control over their organization's data
✅ Can manage employees, timesheets, settings independently
✅ No need to contact platform owner for routine tasks
✅ Faster workflows and better autonomy

### For Platform Owners
✅ Delegation of management tasks
✅ Reduced operational burden
✅ Maintain platform-level control
✅ Clear separation of responsibilities

### For Security
✅ Strong data isolation between organizations
✅ Clear audit trail of all changes
✅ Principle of least privilege enforced
✅ Database-level security (RLS) prevents bypass

## Future Enhancements

1. **Audit Logging**: Track all admin actions for compliance
2. **Permission Granularity**: Add more fine-grained permissions
3. **Multi-Org Admins**: Allow admins to manage multiple organizations
4. **Role Templates**: Pre-defined role configurations
5. **Activity Dashboard**: Show admin activity and statistics

## Related Documentation

- See: `AI_DEVELOPMENT_METHODOLOGY.md` for development process
- See: Supabase RLS documentation for policy syntax
- See: PostgreSQL documentation for SECURITY DEFINER functions

## Support

For issues or questions:
1. Check RLS policies are enabled: `\d+ [table_name]` in psql
2. Verify JWT token contains correct claims
3. Review Supabase logs for policy violations
4. Test with different user roles to isolate issues

---

**Last Updated**: January 26, 2025
**Migration File**: `20250126000000_admin_full_crud_org_scoped.sql`
**Status**: Ready for Testing

