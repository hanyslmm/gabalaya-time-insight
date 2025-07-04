
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import EmployeesPage from '@/pages/EmployeesPage';
import TimesheetsPage from '@/pages/TimesheetsPage';
import SettingsPage from '@/pages/SettingsPage';
import ReportsPage from '@/pages/ReportsPage';
import ClockInOutPage from '@/pages/ClockInOutPage';
import ProfilePage from '@/pages/ProfilePage';
import EmployeeMonitorPage from '@/pages/EmployeeMonitorPage';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import './i18n';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="timesheets" element={<TimesheetsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="clockinout" element={<ClockInOutPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="monitor" element={<EmployeeMonitorPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
            <Toaster />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
