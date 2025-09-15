-- Fix organization_id for hend's timesheet entries
-- The employee 'hend' is in organization bf5df4c0-b729-4599-b680-2fc71531557f
-- but some timesheet entries have null or wrong organization_id

-- Update null organization_id entries for hend
UPDATE timesheet_entries 
SET organization_id = 'bf5df4c0-b729-4599-b680-2fc71531557f'
WHERE employee_name ILIKE '%hend%' 
  AND organization_id IS NULL;

-- Also update entries that are in wrong organization for consistency
UPDATE timesheet_entries 
SET organization_id = 'bf5df4c0-b729-4599-b680-2fc71531557f'
WHERE employee_name ILIKE '%hend%' 
  AND organization_id = 'cf5087d0-7018-4e1c-8d0b-3939275dbf88';