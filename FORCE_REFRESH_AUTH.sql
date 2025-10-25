-- ============================================================================
-- FORCE REFRESH AUTHENTICATION DATA
-- This ensures marwa_user has the correct organization set
-- ============================================================================

-- Step 1: Get Science Club ID
DO $$
DECLARE
  science_club_id UUID;
BEGIN
  -- Get Science Club organization ID
  SELECT id INTO science_club_id 
  FROM organizations 
  WHERE name = 'Science Club'
  LIMIT 1;
  
  IF science_club_id IS NULL THEN
    RAISE EXCEPTION 'Science Club organization not found! Run FIX_ALL_ORGANIZATION_DATA.sql first.';
  END IF;
  
  -- Step 2: Force update marwa_user with all required fields
  UPDATE admin_users
  SET 
    organization_id = science_club_id,
    current_organization_id = science_club_id,
    is_global_owner = FALSE,
    role = 'admin',
    updated_at = NOW()
  WHERE username = 'marwa_user';
  
  RAISE NOTICE '✅ Updated marwa_user with Science Club organization';
  
  -- Step 3: Ensure the organization exists and is valid
  UPDATE organizations
  SET updated_at = NOW()
  WHERE id = science_club_id;
  
END $$;

-- Step 4: Verify the update
SELECT 
  'VERIFICATION' as status,
  au.username,
  au.role,
  au.organization_id,
  au.current_organization_id,
  o.name as organization_name,
  au.is_global_owner
FROM admin_users au
LEFT JOIN organizations o ON o.id = au.organization_id
WHERE au.username = 'marwa_user';

-- Step 5: Show organization details
SELECT 
  'ORGANIZATION DETAILS' as status,
  id,
  name,
  created_at,
  updated_at
FROM organizations
WHERE name = 'Science Club';

-- IMPORTANT: After running this SQL, you MUST:
-- 1. Clear ALL browser data (cookies, localStorage, cache)
-- 2. Close the browser completely
-- 3. Open a new browser window
-- 4. Login fresh with marwa_user / marwa123
