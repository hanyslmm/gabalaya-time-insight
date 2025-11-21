-- Simple query to reactivate work regulations for El Gabalaya
-- This will activate any existing disabled regulation and update its content

UPDATE public.work_regulations
SET 
  is_active = true,
  updated_at = now()
WHERE organization_id IN (
  SELECT id FROM public.organizations
  WHERE name ILIKE '%gabalaya%' OR name ILIKE '%جبلاية%'
  LIMIT 1
)
AND is_active = false;

-- Check if update was successful
SELECT 
  id,
  title,
  is_active,
  updated_at
FROM public.work_regulations
WHERE organization_id IN (
  SELECT id FROM public.organizations
  WHERE name ILIKE '%gabalaya%' OR name ILIKE '%جبلاية%'
  LIMIT 1
);

