
-- Create company_settings table for storing company-wide configuration
CREATE TABLE public.company_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  motivational_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admins full access to company settings
CREATE POLICY "Admin can manage company settings" 
  ON public.company_settings 
  FOR ALL 
  USING (true);

-- Create trigger to update updated_at column
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default motivational message
INSERT INTO public.company_settings (id, motivational_message) 
VALUES (1, 'Keep up the great work! Your dedication and effort make a real difference to our team.')
ON CONFLICT (id) DO NOTHING;
