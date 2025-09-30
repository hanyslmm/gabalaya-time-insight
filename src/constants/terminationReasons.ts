// Termination reasons based on Homebase and HR best practices
export const TERMINATION_REASONS = [
  { value: 'absenteeism', label: 'Absenteeism / Late' },
  { value: 'admin_error', label: 'Admin Error / Accidental Account' },
  { value: 'availability_change', label: 'Availability Change' },
  { value: 'business_conditions', label: 'Business Conditions' },
  { value: 'end_contract', label: 'End of Contract' },
  { value: 'fired', label: 'Fired / Terminated for Cause' },
  { value: 'health_reasons', label: 'Health Reasons' },
  { value: 'moved', label: 'Moved / Relocation' },
  { value: 'performance', label: 'Performance Issues' },
  { value: 'personal_reasons', label: 'Personal Reasons' },
  { value: 'policy_violation', label: 'Policy Violation' },
  { value: 'position_eliminated', label: 'Position Eliminated' },
  { value: 'quit', label: 'Quit / Resigned' },
  { value: 'school', label: 'Returning to School' },
  { value: 'seasonal_end', label: 'Seasonal / End of Season' },
  { value: 'other', label: 'Other' },
] as const;

export type TerminationReason = typeof TERMINATION_REASONS[number]['value'];

export const EMPLOYEE_STATUS = {
  ACTIVE: 'active',
  TERMINATED: 'terminated',
  ON_LEAVE: 'on_leave',
  SUSPENDED: 'suspended',
} as const;

export type EmployeeStatus = typeof EMPLOYEE_STATUS[keyof typeof EMPLOYEE_STATUS];
