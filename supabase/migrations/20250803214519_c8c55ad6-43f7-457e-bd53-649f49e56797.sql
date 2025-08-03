-- Insert missing employees into admin_users table with correct password format
INSERT INTO admin_users (username, full_name, role, password_hash) VALUES
('EMP125549', 'Donia Ashraf', 'employee', 'EMP125549123'),
('EMP193681', 'Salma Salah', 'employee', 'EMP193681123'),
('EMP279988', 'Tabarak Hesham', 'employee', 'EMP279988123'),
('EMP280647', 'Zeinab Afr', 'employee', 'EMP280647123'),
('EMP281869', 'om abdo', 'employee', 'EMP281869123'),
('EMP282757', 'om ebrahem', 'employee', 'EMP282757123'),
('EMP283977', 'shaimaa Ali', 'employee', 'EMP283977123'),
('MAN123', 'Hany', 'employee', 'MAN123123');