-- Add organization scoping to wage_settings and introduce employee_roles table

-- 1) Add organization_id to wage_settings (nullable for a global default row)
ALTER TABLE public.wage_settings
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Ensure only one row per organization (but allow one global row with NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'wage_settings_organization_id_unique'
  ) THEN
    CREATE UNIQUE INDEX wage_settings_organization_id_unique
      ON public.wage_settings(organization_id)
      WHERE organization_id IS NOT NULL;
  END IF;
END$$;

-- Seed per-organization wage_settings from the current global/default row if not present
INSERT INTO public.wage_settings (
  morning_start_time,
  morning_end_time,
  night_start_time,
  night_end_time,
  morning_wage_rate,
  night_wage_rate,
  default_flat_wage_rate,
  organization_id
)
SELECT ws.morning_start_time,
       ws.morning_end_time,
       ws.night_start_time,
       ws.night_end_time,
       ws.morning_wage_rate,
       ws.night_wage_rate,
       ws.default_flat_wage_rate,
       o.id
FROM public.organizations o
CROSS JOIN LATERAL (
  SELECT * FROM public.wage_settings ws_global
  WHERE ws_global.organization_id IS NULL
  ORDER BY ws_global.created_at ASC
  LIMIT 1
) ws
WHERE NOT EXISTS (
  SELECT 1 FROM public.wage_settings ws2 WHERE ws2.organization_id = o.id
);

-- 2) Create employee_roles table scoped by organization
CREATE TABLE IF NOT EXISTS public.employee_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

-- Enable RLS and permissive basic policies (tighten later if needed)
ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage employee roles" ON public.employee_roles;
CREATE POLICY "Manage employee roles" ON public.employee_roles
FOR ALL USING (true) WITH CHECK (true);

-- Seed default roles for each organization if empty
WITH orgs AS (
  SELECT id FROM public.organizations
), defaults AS (
  SELECT unnest(ARRAY['Champion','Barista','Host']) AS name
)
INSERT INTO public.employee_roles (organization_id, name, is_default)
SELECT o.id, d.name, true
FROM orgs o, defaults d
WHERE NOT EXISTS (
  SELECT 1 FROM public.employee_roles er WHERE er.organization_id = o.id
);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_employee_roles_updated_at ON public.employee_roles;
CREATE TRIGGER update_employee_roles_updated_at BEFORE UPDATE ON public.employee_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


