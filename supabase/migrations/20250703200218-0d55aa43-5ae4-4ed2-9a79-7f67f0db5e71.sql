-- Create user accounts for employees who have timesheet entries but no user account
DO $$
DECLARE
    emp_record RECORD;
    default_password TEXT := '$2b$10$defaultpasswordhash'; -- You should change this
BEGIN
    -- Loop through employees who have timesheet entries but no user account
    FOR emp_record IN 
        SELECT DISTINCT e.staff_id, e.full_name
        FROM employees e
        INNER JOIN timesheet_entries te ON e.staff_id = te.employee_name OR e.full_name = te.employee_name
        WHERE NOT EXISTS (
            SELECT 1 FROM users u WHERE u.username = e.staff_id
        )
    LOOP
        -- Insert user account for employee
        INSERT INTO users (username, full_name, password, role)
        VALUES (
            emp_record.staff_id,
            emp_record.full_name,
            default_password,
            'employee'
        );
        
        RAISE NOTICE 'Created user account for employee: % (%)', emp_record.full_name, emp_record.staff_id;
    END LOOP;
END $$;