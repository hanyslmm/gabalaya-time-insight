-- Create company_settings table with required columns
CREATE TABLE IF NOT EXISTS public.company_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  motivational_message TEXT DEFAULT 'Keep up the great work! Your dedication and effort make a real difference to our team.',
  timezone TEXT DEFAULT 'Africa/Cairo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure we have a default record
INSERT INTO public.company_settings (id, motivational_message, timezone) 
VALUES (1, 'Keep up the great work! Your dedication and effort make a real difference to our team.', 'Africa/Cairo')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for company_settings
CREATE POLICY "Company settings are viewable by all authenticated users" 
ON public.company_settings 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Company settings can be updated by admins" 
ON public.company_settings 
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.admin_users 
  WHERE username = (SELECT raw_user_meta_data->>'username' FROM auth.users WHERE id = auth.uid())
  AND role = 'admin'
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();