import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trophy, Search, TrendingUp, Award, AlertCircle, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import ProfileAvatar from '@/components/ProfileAvatar';
import PointsAdjustmentDialog from '@/components/PointsAdjustmentDialog';
import { useEmployeePoints, useOrganizationPointsBudget } from '@/hooks/useEmployeePoints';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  full_name: string;
  staff_id: string;
  status?: string;
}

interface TimesheetEntry {
  id: string;
  clock_in_date: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_hours: number | null;
}

interface PointsLogEntry {
  id: string;
  points: number;
  reason: string;
  occurrence_date: string;
  created_at: string;
  timesheet_entry_id: string | null;
  employee_name: string;
  created_by_name?: string;
}

const PointsManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<{id: string; name: string} | null>(null);
  const [pointsDialogOpen, setPointsDialogOpen] = useState(false);
  const [selectedTimesheetEntry, setSelectedTimesheetEntry] = useState<string | null>(null);
  const [showTimesheetSelector, setShowTimesheetSelector] = useState(false);

  // Check if points system is active
  const { data: orgData } = useQuery({
    queryKey: ['organization', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('is_points_system_active')
        .eq('id', activeOrganizationId)
        .single();
      
      if (error && !error.message?.includes('does not exist')) throw error;
      return (data as any) || { is_points_system_active: false };
    }
  });

  const isPointsSystemActive = orgData?.is_points_system_active ?? false;

  // Fetch employees
  const { data: employees = [], isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ['employees-for-points', activeOrganizationId],
    enabled: !!activeOrganizationId && isPointsSystemActive,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, staff_id, status')
        .eq('organization_id', activeOrganizationId)
        .order('full_name');
      
      if (error) throw error;
      return (data || []) as Employee[];
    }
  });

  // Fetch recent points transactions
  const { data: recentPointsLog = [] } = useQuery<PointsLogEntry[]>({
    queryKey: ['points-log-recent', activeOrganizationId],
    enabled: !!activeOrganizationId && isPointsSystemActive,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('employee_points_log')
        .select(`
          id,
          points,
          reason,
          occurrence_date,
          created_at,
          timesheet_entry_id,
          employees!inner(full_name),
          admin_users(username)
        `)
        .eq('organization_id', activeOrganizationId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      return (data || []).map((entry: any) => ({
        id: entry.id,
        points: entry.points,
        reason: entry.reason,
        occurrence_date: entry.occurrence_date,
        created_at: entry.created_at,
        timesheet_entry_id: entry.timesheet_entry_id,
        employee_name: entry.employees?.full_name || 'Unknown',
        created_by_name: entry.admin_users?.username || 'System'
      })) as PointsLogEntry[];
    }
  });

  // Budget data
  const { data: budgetData } = useOrganizationPointsBudget();

  // Filter employees
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter(emp => 
      emp.full_name.toLowerCase().includes(term) ||
      emp.staff_id.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  const handleAwardPoints = (employee: Employee) => {
    setSelectedEmployee({ id: employee.id, name: employee.full_name });
    setPointsDialogOpen(true);
  };

  if (!isPointsSystemActive) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <Card className="mt-8">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('pointsSystemNotActive')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('pointsSystemNotEnabled')}
            </p>
            <Button onClick={() => window.location.href = '/company-settings'}>
              {t('goToCompanySettings')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-400 bg-clip-text text-transparent flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-600" />
          {t('pointsManagement')}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t('awardAndManagePoints')}
        </p>
      </div>

      {/* Budget Status Card */}
      {budgetData && (
        <Card className="mb-6 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">{t('availableBudget')}</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                    {budgetData.budget}
                  </span>
                  <span className="text-sm text-muted-foreground">{t('points')}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {budgetData.budget * budgetData.pointValue} {t('egpAvailable')}
                </p>
              </div>
              <div className="text-right rtl:text-left">
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/company-settings'}
                  size="sm"
                >
                  {t('topUpBudget')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employees List */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('allEmployees')}</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 rtl:left-auto rtl:right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchEmployees')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 rtl:pl-0 rtl:pr-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {employeesLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t('loadingEmployees')}</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? t('noEmployeesFoundMatching') : t('noEmployeesFound')}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEmployees.map((employee) => (
                <EmployeePointsRow
                  key={employee.id}
                  employee={employee}
                  onAwardPoints={handleAwardPoints}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Points Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('recentPointsTransactions')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentPointsLog.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noPointsTransactionsYet')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('points')}</TableHead>
                    <TableHead>{t('reason')}</TableHead>
                    <TableHead>{t('occurrenceDate')}</TableHead>
                    <TableHead>{t('awardedBy')}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPointsLog.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.employee_name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            entry.points > 0
                              ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                              : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                          )}
                        >
                          {entry.points > 0 ? '+' : ''}{entry.points}
                        </Badge>
                      </TableCell>
                      <TableCell>{entry.reason}</TableCell>
                      <TableCell>
                        {format(new Date(entry.occurrence_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.created_by_name || 'System'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(entry.created_at), 'MMM dd, HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Points Adjustment Dialog */}
      {selectedEmployee && (
        <PointsAdjustmentDialog
          open={pointsDialogOpen}
          onOpenChange={(open) => {
            setPointsDialogOpen(open);
            if (!open) {
              setSelectedEmployee(null);
              setSelectedTimesheetEntry(null);
            }
          }}
          employeeId={selectedEmployee.id}
          employeeName={selectedEmployee.name}
          timesheetEntryId={selectedTimesheetEntry || undefined}
        />
      )}
    </div>
  );
};

// Employee Points Row Component
const EmployeePointsRow: React.FC<{
  employee: Employee;
  onAwardPoints: (employee: Employee) => void;
}> = ({ employee, onAwardPoints }) => {
  const { t } = useTranslation();
  const { data: pointsData } = useEmployeePoints(employee.id);

  const getPointsBadgeColor = (points: number) => {
    if (points >= 100) return 'bg-yellow-500 text-yellow-950';
    if (points >= 50) return 'bg-gray-400 text-gray-950';
    if (points >= 25) return 'bg-amber-600 text-amber-950';
    return 'bg-blue-500 text-blue-950';
  };

  const getPointsBadgeIcon = (points: number) => {
    if (points >= 100) return '🏆';
    if (points >= 50) return '🥇';
    if (points >= 25) return '⭐';
    return '🎯';
  };

  const getLevelTranslation = (level: string) => {
    const levelMap: Record<string, string> = {
      'Starter': t('starter'),
      'Rising Star': t('risingStar'),
      'Champion': t('champion'),
      'Legend': t('legend'),
      'Improving': t('improving')
    };
    return levelMap[level] || level;
  };

  if (!pointsData || !pointsData.isPointsSystemActive) {
    return null;
  }

  return (
    <Card className="hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <ProfileAvatar employeeName={employee.full_name} size="md" />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-lg">{employee.full_name}</h3>
                <Badge variant="outline" className="text-xs">
                  {employee.staff_id}
                </Badge>
                {employee.status && (
                  <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                    {employee.status}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge
                  className={cn(
                    "text-xs font-bold px-2 py-1",
                    getPointsBadgeColor(pointsData.totalPoints)
                  )}
                >
                  <span className="mr-1 rtl:mr-0 rtl:ml-1">{getPointsBadgeIcon(pointsData.totalPoints)}</span>
                  {pointsData.totalPoints} {t('points')}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {getLevelTranslation(pointsData.level)}
                </span>
                <span className="text-sm text-muted-foreground">
                  • {t('potentialBonus')}: {pointsData.bonusEGP.toFixed(2)} {t('currencySymbol')}
                </span>
              </div>
            </div>
          </div>
          <Button
            onClick={() => onAwardPoints(employee)}
            variant="outline"
            className="ml-4 rtl:ml-0 rtl:mr-4"
          >
            <Trophy className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2 text-yellow-600 dark:text-yellow-400" />
            {t('awardPoints')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PointsManagementPage;
