
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from '@/components/ui/sonner';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import NotFound from '@/pages/NotFound';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Suspense, lazy, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n';
import './App.css';

// Lazy load components for better performance
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const EmployeesPage = lazy(() => import('@/pages/EmployeesPage'));
const TimesheetsPage = lazy(() => import('@/pages/TimesheetsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const ClockInOutPage = lazy(() => import('@/pages/ClockInOutPage'));
const MyTimesheetPage = lazy(() => import('@/pages/MyTimesheetPage'));
const CompanySettingsPage = lazy(() => import('@/pages/CompanySettingsPage'));
const OrganizationManagement = lazy(() => import('@/components/OrganizationManagement'));
const TaskManagementPage = lazy(() => import('@/pages/TaskManagementPage'));
const WorkRegulationsPage = lazy(() => import('@/pages/WorkRegulationsPage'));
const PointsManagementPage = lazy(() => import('@/pages/PointsManagementPage'));
const MyPointsPage = lazy(() => import('@/pages/MyPointsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
  </div>
);

function App() {
  const { i18n } = useTranslation();

  // Set document direction and language based on i18n language
  useEffect(() => {
    const direction = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = direction;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <div className="min-h-screen w-full bg-background overflow-x-hidden">
              <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/clock-in-out" replace />} />
                <Route path="dashboard" element={
                  <Suspense fallback={<PageLoader />}>
                    <DashboardPage />
                  </Suspense>
                } />
                <Route path="clock-in-out" element={
                  <Suspense fallback={<PageLoader />}>
                    <ClockInOutPage />
                  </Suspense>
                } />
                <Route path="my-timesheet" element={
                  <Suspense fallback={<PageLoader />}>
                    <MyTimesheetPage />
                  </Suspense>
                } />
                <Route path="employees" element={
                  <Suspense fallback={<PageLoader />}>
                    <EmployeesPage />
                  </Suspense>
                } />
                <Route path="timesheets" element={
                  <Suspense fallback={<PageLoader />}>
                    <TimesheetsPage />
                  </Suspense>
                } />
                <Route path="reports" element={
                  <Suspense fallback={<PageLoader />}>
                    <ReportsPage />
                  </Suspense>
                } />
                <Route path="company-settings" element={
                  <Suspense fallback={<PageLoader />}>
                    <CompanySettingsPage />
                  </Suspense>
                } />
                <Route path="organizations" element={
                  <Suspense fallback={<PageLoader />}>
                    <OrganizationManagement />
                  </Suspense>
                } />
                <Route path="settings" element={
                  <Suspense fallback={<PageLoader />}>
                    <SettingsPage />
                  </Suspense>
                } />
                <Route path="profile" element={
                  <Suspense fallback={<PageLoader />}>
                    <ProfilePage />
                  </Suspense>
                } />
                <Route path="task-management" element={
                  <Suspense fallback={<PageLoader />}>
                    <TaskManagementPage />
                  </Suspense>
                } />
                <Route path="work-regulations" element={
                  <Suspense fallback={<PageLoader />}>
                    <WorkRegulationsPage />
                  </Suspense>
                } />
                <Route path="points-management" element={
                  <Suspense fallback={<PageLoader />}>
                    <PointsManagementPage />
                  </Suspense>
                } />
                <Route path="my-points" element={
                  <Suspense fallback={<PageLoader />}>
                    <MyPointsPage />
                  </Suspense>
                } />
              </Route>
              <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            <Toaster />
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
