import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Trophy, Sparkles, AlertCircle, Star, Award } from 'lucide-react';
import { useEmployeePoints } from '@/hooks/useEmployeePoints';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface CatalogItem {
  id: string;
  label: string;
  points: number;
  category: 'reward' | 'penalty';
  description?: string | null;
}

interface PointsLogEntry {
  id: string;
  points: number;
  reason: string;
  occurrence_date: string;
  created_at: string;
  created_by_name?: string | null;
}

const MyPointsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;

  const { data: me } = useQuery<{ id: string; full_name: string } | null>({
    queryKey: ['current-employee-record', user?.username, user?.full_name, activeOrganizationId],
    enabled: !!user && !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, staff_id')
        .eq('organization_id', activeOrganizationId)
        .or(`staff_id.eq.${user?.username},full_name.eq.${user?.full_name}`)
        .limit(1);
      if (error) return null;
      const rec = (data || [])[0];
      if (!rec) return null;
      return { id: rec.id, full_name: rec.full_name };
    }
  });

  const employeeId = me?.id || null;
  const { data: pointsData } = useEmployeePoints(employeeId);

  const { data: motivation } = useQuery<{ motivational_message: string } | null>({
    queryKey: ['company-motivation', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('motivational_message')
        .eq('organization_id', activeOrganizationId)
        .single();
      if (error) return null;
      return data as any;
    }
  });

  const { data: catalog = [] } = useQuery<CatalogItem[]>({
    queryKey: ['points-catalog-view', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('points_catalog')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .eq('is_active', true)
        .order('category', { ascending: false })
        .order('points', { ascending: false });
      if (error) return [] as CatalogItem[];
      return (data || []) as CatalogItem[];
    }
  });

  const { data: logs = [] } = useQuery<PointsLogEntry[]>({
    queryKey: ['my-points-log', employeeId, activeOrganizationId],
    enabled: !!employeeId && !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('employee_points_log')
        .select(`id, points, reason, occurrence_date, created_at, admin_users(username)`) 
        .eq('organization_id', activeOrganizationId)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return [] as PointsLogEntry[];
      return (data || []).map((entry: any) => ({
        id: entry.id,
        points: entry.points,
        reason: entry.reason,
        occurrence_date: entry.occurrence_date,
        created_at: entry.created_at,
        created_by_name: entry.admin_users?.username || 'System'
      })) as PointsLogEntry[];
    }
  });

  const { data: last30Summary } = useQuery<{ total: number; days: number } | null>({
    queryKey: ['my-points-last30', employeeId, activeOrganizationId],
    enabled: !!employeeId && !!activeOrganizationId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from('employee_points_log')
        .select('points, occurrence_date')
        .eq('organization_id', activeOrganizationId)
        .eq('employee_id', employeeId)
        .gte('occurrence_date', since.toISOString().substring(0, 10));
      if (error) return null;
      const total = (data || []).reduce((sum: number, r: any) => sum + (r.points || 0), 0);
      const days = Array.from(new Set((data || []).map((r: any) => r.occurrence_date))).length;
      return { total, days };
    }
  });

  const rewards = useMemo(() => catalog.filter(c => c.category === 'reward'), [catalog]);
  const penalties = useMemo(() => catalog.filter(c => c.category === 'penalty'), [catalog]);

  const totalPoints = pointsData?.totalPoints || 0;
  const level = pointsData?.level || 'Starter';
  const bonusEGP = pointsData?.bonusEGP || 0;
  const thresholds = [10, 25, 50, 100];
  const nextTarget = thresholds.find(t => totalPoints < t) || 100;
  const progressValue = Math.min(Math.max((totalPoints / nextTarget) * 100, 0), 100);
  const remainingToNext = Math.max(nextTarget - totalPoints, 0);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-400 bg-clip-text text-transparent flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-600" />
              {t('myPoints') || 'نقاطي'}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t('pointsProgressOverview') || 'عرض التقدم، والحوافز، وسجل النقاط'}
            </p>
          </div>
          {motivation?.motivational_message && (
            <div className="max-w-xl p-3 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
              {motivation.motivational_message}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-yellow-950/20 dark:to-amber-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-600" />
              {t('yourProgress') || 'تقدمك'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="text-sm">{totalPoints} {t('points') || 'نقطة'}</Badge>
              <span className="text-sm text-muted-foreground">{level}</span>
              <span className="text-sm text-muted-foreground">• {t('potentialBonus') || 'مكافأة محتملة'}: {bonusEGP.toFixed(2)} {t('currencySymbol') || 'جنيه'}</span>
            </div>
            <div>
              <Progress value={progressValue} />
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                <span>{t('nextLevelProgress') || 'التقدم نحو المستوى التالي'}</span>
                <span>{Math.round(progressValue)}%</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg border bg-background">
                <div className="text-lg font-bold">{nextTarget}</div>
                <div className="text-xs text-muted-foreground">{t('targetPoints') || 'هدف المستوى'}</div>
              </div>
              <div className="text-center p-3 rounded-lg border bg-background">
                <div className="text-lg font-bold">{totalPoints}</div>
                <div className="text-xs text-muted-foreground">{t('pointsEarned') || 'نقاط مكتسبة'}</div>
              </div>
              <div className="text-center p-3 rounded-lg border bg-background">
                <div className="text-lg font-bold">{remainingToNext}</div>
                <div className="text-xs text-muted-foreground">{t('remaining') || 'المتبقي'}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg border bg-background">
                <div className="text-lg font-bold">{last30Summary?.days || 0}</div>
                <div className="text-xs text-muted-foreground">{t('activeDays30') || 'أيام نشاط خلال 30 يوم'}</div>
              </div>
              <div className="text-center p-3 rounded-lg border bg-background">
                <div className="text-lg font-bold">{last30Summary?.total || 0}</div>
                <div className="text-xs text-muted-foreground">{t('pointsLast30') || 'نقاط آخر 30 يوم'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">
                {t('keepGoing') || 'استمر! إنجازك يقترب من المستوى التالي.'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-600" />
              {t('pointsCatalog') || 'كتالوج النقاط'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {rewards.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">{t('rewards') || 'مكافآت'}</Badge>
                  <span className="text-muted-foreground text-sm">({rewards.length})</span>
                </h3>
                <div className="space-y-2">
                  {rewards.map(item => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                        )}
                      </div>
                      <Badge variant="outline" className="bg-green-50 text-green-700">+{item.points}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {penalties.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="destructive">{t('penalties') || 'جزاءات'}</Badge>
                  <span className="text-muted-foreground text-sm">({penalties.length})</span>
                </h3>
                <div className="space-y-2">
                  {penalties.map(item => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                        )}
                      </div>
                      <Badge variant="outline" className="bg-red-50 text-red-700">{item.points}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {rewards.length === 0 && penalties.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                {t('noCatalogItems') || 'لا توجد عناصر في الكتالوج بعد.'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {t('yourPointsHistory') || 'سجل نقاطك'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noPointsTransactionsYet') || 'لا توجد عمليات نقاط بعد.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('points') || 'النقاط'}</TableHead>
                    <TableHead>{t('reason') || 'السبب'}</TableHead>
                    <TableHead>{t('occurrenceDate') || 'تاريخ الواقعة'}</TableHead>
                    <TableHead>{t('awardedBy') || 'المُضيف'}</TableHead>
                    <TableHead>{t('date') || 'التاريخ'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            entry.points > 0
                              ? 'bg-green-50 text-green-700'
                              : 'bg-red-50 text-red-700'
                          )}
                        >
                          {entry.points > 0 ? '+' : ''}{entry.points}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{entry.reason}</TableCell>
                      <TableCell>{format(new Date(entry.occurrence_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.created_by_name || 'System'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(entry.created_at), 'MMM dd, HH:mm')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyPointsPage;
