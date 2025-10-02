-- Create enum types for timesheet change requests
CREATE TYPE public.timesheet_request_type AS ENUM ('edit', 'add', 'delete');
CREATE TYPE public.timesheet_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create table for timesheet change requests
CREATE TABLE public.timesheet_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  request_type public.timesheet_request_type NOT NULL,
  status public.timesheet_request_status NOT NULL DEFAULT 'pending',
  
  -- Original entry (for edit/delete requests)
  original_entry_id UUID REFERENCES public.timesheet_entries(id) ON DELETE CASCADE,
  
  -- Original values (for audit trail in edit/delete requests)
  original_clock_in_date DATE,
  original_clock_in_time TIME,
  original_clock_out_date DATE,
  original_clock_out_time TIME,
  
  -- Requested changes (for edit/add requests)
  requested_clock_in_date DATE,
  requested_clock_in_time TIME,
  requested_clock_out_date DATE,
  requested_clock_out_time TIME,
  requested_clock_in_location TEXT,
  requested_clock_out_location TEXT,
  
  -- Justification
  justification_category TEXT NOT NULL,
  justification_details TEXT,
  
  -- Admin response
  reviewed_by UUID REFERENCES public.admin_users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.timesheet_change_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Employees can view their own requests
CREATE POLICY "Employees can view their own requests"
ON public.timesheet_change_requests
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
  )
);

-- Employees can create their own requests
CREATE POLICY "Employees can create their own requests"
ON public.timesheet_change_requests
FOR INSERT
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
  )
);

-- Admins can view all requests in their organization
CREATE POLICY "Admins can view requests in their organization"
ON public.timesheet_change_requests
FOR SELECT
USING (
  (auth.jwt() ->> 'role'::text) IN ('admin', 'owner') 
  AND (
    organization_id = (
      SELECT organization_id FROM public.admin_users 
      WHERE username = (auth.jwt() ->> 'username'::text)
    )
    OR organization_id IS NULL  -- Support legacy data
  )
);

-- Admins can update requests in their organization
CREATE POLICY "Admins can update requests in their organization"
ON public.timesheet_change_requests
FOR UPDATE
USING (
  (auth.jwt() ->> 'role'::text) IN ('admin', 'owner') 
  AND (
    organization_id = (
      SELECT organization_id FROM public.admin_users 
      WHERE username = (auth.jwt() ->> 'username'::text)
    )
    OR organization_id IS NULL  -- Support legacy data
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_timesheet_change_requests_updated_at
BEFORE UPDATE ON public.timesheet_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_timesheet_change_requests_employee_id ON public.timesheet_change_requests(employee_id);
CREATE INDEX idx_timesheet_change_requests_organization_id ON public.timesheet_change_requests(organization_id);
CREATE INDEX idx_timesheet_change_requests_status ON public.timesheet_change_requests(status);
CREATE INDEX idx_timesheet_change_requests_created_at ON public.timesheet_change_requests(created_at DESC);