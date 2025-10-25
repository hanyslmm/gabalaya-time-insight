# Debug Organization Display Issue

## Quick Debug Steps

### 1. Check Browser Console
Open browser console (F12) and check for:
- Any errors when loading the page
- The user object being logged

### 2. Add Debug Code
In browser console, run:
```javascript
// Check what's in localStorage
console.log('Auth Token:', localStorage.getItem('auth_token'));

// Decode the token to see what's inside
const token = localStorage.getItem('auth_token');
if (token) {
  const payload = JSON.parse(atob(token));
  console.log('Token payload:', payload);
}

// Check the user object from React
// This will vary based on your React DevTools
```

### 3. SQL Query to Verify Data
Run this in Supabase:
```sql
-- Check marwa_user's actual data
SELECT 
  au.username,
  au.role,
  au.organization_id,
  au.current_organization_id,
  o1.name as org_name,
  o2.name as current_org_name
FROM admin_users au
LEFT JOIN organizations o1 ON o1.id = au.organization_id
LEFT JOIN organizations o2 ON o2.id = au.current_organization_id
WHERE au.username = 'marwa_user';
```

## The Fix

The issue is likely that the organization_id is in the database but not being passed through the authentication flow properly. Let me create a quick fix:
