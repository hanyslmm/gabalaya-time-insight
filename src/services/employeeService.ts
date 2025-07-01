
import { supabase } from '@/integrations/supabase/client';

export const createOrFindEmployee = async (employeeName: string, payrollId?: string) => {
  console.log('Creating or finding employee:', employeeName, 'Payroll ID:', payrollId);
  
  // First, try to find existing employee by name
  const { data: existingEmployee, error: findError } = await supabase
    .from('employees')
    .select('*')
    .ilike('full_name', employeeName)
    .single();

  if (findError && findError.code !== 'PGRST116') {
    console.error('Error finding employee:', findError);
    throw findError;
  }

  if (existingEmployee) {
    console.log('Found existing employee:', existingEmployee);
    return existingEmployee.id;
  }

  // If employee doesn't exist, create new one
  const staffId = payrollId || `EMP${Date.now().toString().slice(-6)}`;
  const newEmployee = {
    staff_id: staffId,
    full_name: employeeName,
    role: 'Employee',
    hiring_date: new Date().toISOString().split('T')[0], // Today's date
    email: null,
    phone_number: null
  };

  console.log('Creating new employee:', newEmployee);

  const { data: createdEmployee, error: createError } = await supabase
    .from('employees')
    .insert(newEmployee)
    .select()
    .single();

  if (createError) {
    console.error('Error creating employee:', createError);
    throw createError;
  }

  console.log('Created new employee:', createdEmployee);
  return createdEmployee.id;
};
