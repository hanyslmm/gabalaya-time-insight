export const JUSTIFICATION_CATEGORIES = [
  { value: 'technical_issue', label: 'Technical Issue (Phone/Internet)' },
  { value: 'forgot_clockin', label: 'Forgot to Clock In' },
  { value: 'forgot_clockout', label: 'Forgot to Clock Out' },
  { value: 'wrong_time', label: 'Entered Wrong Time' },
  { value: 'system_error', label: 'System Error' },
  { value: 'other', label: 'Other (Please Specify)' },
] as const;

export type JustificationCategory = typeof JUSTIFICATION_CATEGORIES[number]['value'];
