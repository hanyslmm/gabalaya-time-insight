import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEmployeePoints } from '@/hooks/useEmployeePoints';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Trophy, Star, Sparkles, TrendingUp, Award, Zap, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface PointsLogEntry {
  id: string;
  points: number;
  reason: string;
  occurrence_date: string;
  created_at: string;
  created_by_name?: string;
}

const EmployeePointsCard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

  // For employees, we need to lookup the employee ID from the employees table by staff_id
  // because user.id from unified-auth doesn't match the employees table ID
  const { data: employeeData, isLoading: isLoadingEmployeeId } = useQuery<{ id: string } | null>({
    queryKey: ['employee-id-by-staff', user?.username, activeOrganizationId],
    enabled: !!user && user.role === 'employee' && !!activeOrganizationId,
    queryFn: async () => {
      if (!user || !activeOrganizationId) return null;

      console.log('EmployeePointsCard: Looking up employee by staff_id:', user.username);

      const { data, error } = await supabase
        .from('employees')
        .select('id')
        .eq('organization_id', activeOrganizationId)
        .eq('staff_id', user.username)
        .maybeSingle();

      if (error) {
        console.error('Error fetching employee ID:', error);
        return null;
      }

      console.log('EmployeePointsCard: Found employee ID:', data?.id);
      return data;
    }
  });

  const employeeId = employeeData?.id || null;
  const { data: pointsData, isLoading: isLoadingPoints, refetch } = useEmployeePoints(employeeId);

  // Fetch next level threshold and current level min points for progress calculation
  const { data: levelProgressData } = useQuery<{ nextThreshold: number; currentMin: number }>({
    queryKey: ['level-progress', employeeId, activeOrganizationId, pointsData?.level, pointsData?.totalPoints],
    enabled: !!employeeId && !!activeOrganizationId && !!pointsData,
    queryFn: async () => {
      if (!employeeId || !activeOrganizationId || !pointsData) return { nextThreshold: 25, currentMin: 0 };

      // Get next level threshold
      const { data: nextThreshold, error: nextError } = await supabase.rpc('get_next_level_threshold' as any, {
        p_employee_id: employeeId
      });

      // Get current level's min_points from points_levels table
      let currentMin = 0;
      if (pointsData.level) {
        const { data: levelData, error: levelError } = await (supabase as any)
          .from('points_levels')
          .select('min_points')
          .eq('organization_id', activeOrganizationId)
          .eq('level_name', pointsData.level)
          .eq('is_active', true)
          .maybeSingle();

        if (!levelError && levelData) {
          currentMin = levelData.min_points || 0;
        } else {
          // Fallback to hardcoded values if custom level not found
          const totalPts = pointsData.totalPoints || 0;
          if (totalPts >= 100) currentMin = 100;
          else if (totalPts >= 50) currentMin = 50;
          else if (totalPts >= 25) currentMin = 25;
          else currentMin = 0;
        }
      }

      return {
        nextThreshold: (nextError ? 25 : (nextThreshold || 25)),
        currentMin
      };
    }
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['employee-points', employeeId, activeOrganizationId] });
    queryClient.invalidateQueries({ queryKey: ['employee-points-activity', employeeId, activeOrganizationId] });
    queryClient.invalidateQueries({ queryKey: ['level-progress', employeeId, activeOrganizationId] });
    refetch();
  };

  // Debug logging
  React.useEffect(() => {
    if (user?.role === 'employee') {
      console.log('EmployeePointsCard Debug:', {
        employeeId,
        userId: user.id,
        username: user.username,
        userRole: user.role,
        pointsData,
        isLoadingPoints,
        activeOrganizationId
      });
    }
  }, [employeeId, user, pointsData, isLoadingPoints, activeOrganizationId]);

  // Also check if we can query points directly
  React.useEffect(() => {
    if (user?.role === 'employee' && activeOrganizationId) {
      // Direct query to verify data exists
      (async () => {
        console.log('=== EmployeePointsCard: Direct Query Debug ===');
        console.log('Looking for points with employee_id:', employeeId);
        console.log('User object:', user);

        // Query 1: Try with the employeeId (user.id)
        const { data: data1, error: error1 } = await (supabase as any)
          .from('employee_points_log')
          .select('employee_id, points, reason, created_at')
          .eq('employee_id', employeeId)
          .eq('organization_id', activeOrganizationId)
          .limit(10);

        console.log('Query 1 (by user.id):', { employeeId, data: data1, error: error1, count: data1?.length });
        if (data1) console.table(data1);

        // Query 2: Try to find ANY points for this organization to see employee_id values
        const { data: data2, error: error2 } = await (supabase as any)
          .from('employee_points_log')
          .select('employee_id, points, reason, created_at')
          .eq('organization_id', activeOrganizationId)
          .limit(20);

        console.log('Query 2 (all for org):', { data: data2, error: error2, count: data2?.length });
        if (data2 && data2.length > 0) {
          console.log('All employee_id values in points log:');
          console.table(data2);
          const uniqueIds = [...new Set(data2.map((e: any) => e.employee_id))];
          console.log('Unique employee_ids:', uniqueIds);
        }

        // Query 3: Check employee table for this user
        const { data: data3, error: error3 } = await supabase
          .from('employees')
          .select('id, staff_id, full_name')
          .eq('organization_id', activeOrganizationId)
          .or(`id.eq.${user.id},staff_id.eq.${user.username}`)
          .limit(5);

        console.log('Query 3 (employees table):', { data: data3, error: error3 });
        if (data3) console.table(data3);

        if (data1 && data1.length > 0) {
          const sum = data1.reduce((acc: number, entry: any) => acc + (entry.points || 0), 0);
          console.log('EmployeePointsCard: Sum from direct query:', sum);
        }
        console.log('=== End Debug ===');
      })();
    }
  }, [employeeId, activeOrganizationId, user]);

  // Fetch recent points activity (last 3 events)
  const { data: recentActivity = [] } = useQuery<PointsLogEntry[]>({
    queryKey: ['employee-points-activity', employeeId, activeOrganizationId],
    enabled: !!employeeId && !!activeOrganizationId && !!pointsData?.isPointsSystemActive,
    queryFn: async () => {
      if (!employeeId || !activeOrganizationId) return [];

      const { data, error } = await (supabase as any)
        .from('employee_points_log')
        .select(`
          id,
          points,
          reason,
          occurrence_date,
          created_at,
          created_by:admin_users(full_name)
        `)
        .eq('employee_id', employeeId)
        .eq('organization_id', activeOrganizationId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Error fetching points activity:', error);
        return [];
      }

      return (data || []).map((entry: any) => ({
        id: entry.id,
        points: entry.points,
        reason: entry.reason,
        occurrence_date: entry.occurrence_date,
        created_at: entry.created_at,
        created_by_name: entry.created_by?.full_name || 'System'
      }));
    }
  });

  // Don't show if not an employee
  if (!user || user.role !== 'employee') {
    return null;
  }

  // Show loading state
  if (isLoadingEmployeeId || isLoadingPoints) {
    return (
      <Card className="border-2 border-muted">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show if points system not active
  if (!pointsData || !pointsData.isPointsSystemActive) {
    return null;
  }

  const { totalPoints, level, bonusEGP } = pointsData;

  // Calculate progress to next level
  // Calculate current level's min points and next level threshold
  const getLevelRanges = () => {
    const threshold = levelProgressData?.nextThreshold || 25;
    const currentMin = levelProgressData?.currentMin || 0;

    return {
      current: currentMin,
      next: threshold,
      label: pointsData?.level || 'Starter',
      pointsRemaining: Math.max(0, threshold - totalPoints)
    };
  };

  const levelRange = getLevelRanges();
  const progress = levelRange.next > levelRange.current
    ? Math.min(100, Math.max(0, ((totalPoints - levelRange.current) / (levelRange.next - levelRange.current)) * 100))
    : 100;

  // Get level icon and color
  const getLevelConfig = () => {
    if (totalPoints >= 100) {
      return {
        icon: Trophy,
        gradient: 'from-yellow-500 via-yellow-400 to-yellow-300',
        bgGradient: 'from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/20',
        borderColor: 'border-yellow-300 dark:border-yellow-700',
        badgeColor: 'bg-yellow-500 text-yellow-950',
        glow: 'shadow-yellow-500/50'
      };
    }
    if (totalPoints >= 50) {
      return {
        icon: Star,
        gradient: 'from-purple-500 via-purple-400 to-purple-300',
        bgGradient: 'from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/20',
        borderColor: 'border-purple-300 dark:border-purple-700',
        badgeColor: 'bg-purple-500 text-purple-950',
        glow: 'shadow-purple-500/50'
      };
    }
    if (totalPoints >= 25) {
      return {
        icon: Sparkles,
        gradient: 'from-blue-500 via-blue-400 to-blue-300',
        bgGradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/20',
        borderColor: 'border-blue-300 dark:border-blue-700',
        badgeColor: 'bg-blue-500 text-blue-950',
        glow: 'shadow-blue-500/50'
      };
    }
    return {
      icon: Zap,
      gradient: 'from-green-500 via-green-400 to-green-300',
      bgGradient: 'from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20',
      borderColor: 'border-green-300 dark:border-green-700',
      badgeColor: 'bg-green-500 text-green-950',
      glow: 'shadow-green-500/50'
    };
  };

  const levelConfig = getLevelConfig();
  const LevelIcon = levelConfig.icon;

  // Get level translation
  const getLevelTranslation = (levelName: string) => {
    const levelMap: Record<string, string> = {
      'Starter': t('starter'),
      'Rising Star': t('risingStar'),
      'Champion': t('champion'),
      'Legend': t('legend'),
      'Improving': t('improving')
    };
    return levelMap[levelName] || levelName;
  };

  return (
    <Card className={cn(
      "overflow-hidden border-2",
      levelConfig.borderColor,
      "bg-gradient-to-br",
      levelConfig.bgGradient,
      "shadow-lg",
      levelConfig.glow
    )}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-3 rounded-xl bg-gradient-to-br",
              levelConfig.gradient,
              "shadow-lg"
            )}>
              <LevelIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {t('pointsManagement')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {getLevelTranslation(level)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn("text-sm font-bold px-3 py-1", levelConfig.badgeColor)}>
              {totalPoints} {t('points')}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-8 w-8 p-0"
              title={t('refresh') || 'Refresh'}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-background/50 dark:bg-background/20 rounded-lg p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-xs text-muted-foreground">{t('totalScore') || 'Total Score'}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalPoints}</p>
          </div>
          <div className="bg-background/50 dark:bg-background/20 rounded-lg p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs text-muted-foreground">{t('potentialBonus')}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-1">
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                {bonusEGP.toFixed(2)}
              </span>
              <span className="text-sm font-medium text-green-600/80 dark:text-green-400/80 break-all">
                {t('currencySymbol')}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              {t('progressToNextLevel') || 'Progress to Next Level'}
            </span>
            <span className="text-xs text-muted-foreground">
              {totalPoints}/{levelRange.next} {t('points')}
            </span>
          </div>
          <Progress
            value={Math.min(progress, 100)}
            className="h-3 bg-background/50"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {levelRange.next - totalPoints > 0
              ? `${levelRange.next - totalPoints} ${t('points')} until ${getLevelTranslation(levelRange.label)}`
              : t('maxLevelReached') || 'Maximum level reached!'
            }
          </p>
        </div>

        {/* Recent Activity Timeline */}
        {recentActivity.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                {t('recentActivity')}
              </span>
            </div>
            <div className="space-y-3">
              {recentActivity.map((entry, index) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-2",
                    entry.points > 0 ? "bg-green-500" : "bg-red-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {entry.reason}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-bold shrink-0",
                          entry.points > 0
                            ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-300"
                            : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300"
                        )}
                      >
                        {entry.points > 0 ? '+' : ''}{entry.points}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(entry.occurrence_date), 'MMM dd, yyyy')}</span>
                      {entry.created_by_name && (
                        <>
                          <span>•</span>
                          <span>{entry.created_by_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentActivity.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            {t('noPointsActivityYet') || 'No points activity yet'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeePointsCard;

