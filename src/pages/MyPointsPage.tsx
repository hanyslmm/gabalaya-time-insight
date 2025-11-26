import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Trophy, Sparkles, AlertCircle } from 'lucide-react';
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

  const rewards = useMemo(() => catalog.filter(c => c.category === 'reward'), [catalog]);
  const penalties = useMemo(() => catalog.filter(c => c.category === 'penalty'), [catalog]);

  const totalPoints = pointsData?.totalPoints || 0;
  const level = pointsData?.level || 'Starter';
  const bonusEGP = pointsData?.bonusEGP || 0;
  const progressValue = Math.min(Math.max((totalPoints % 25) / 25 * 100, 0), 100);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-400 bg-clip-text text-transparent flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-600" />
          {t('myPoints') || 'My Points'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t('pointsProgressOverview') || 'See your points, progress, and the catalog.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t('yourProgress') || 'Your Progress'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className="text-sm">{totalPoints} {t('points') || 'points'}</Badge>
              <span className="text-sm text-muted-foreground">{level}</span>
              <span className="text-sm text-muted-foreground">• {t('potentialBonus') || 'Potential Bonus'}: {bonusEGP.toFixed(2)} {t('currencySymbol') || 'EGP'}</span>
            </div>
            <Progress value={progressValue} />
            <p className="text-xs text-muted-foreground">{t('nextLevelProgress') || 'Progress to next level'} ({Math.round(progressValue)}%)</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-600" />
              {t('pointsCatalog') || 'Points Catalog'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {rewards.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">{t('rewards') || 'Rewards'}</Badge>
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
                  <Badge variant="destructive">{t('penalties') || 'Penalties'}</Badge>
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
                {t('noCatalogItems') || 'No catalog items yet.'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {t('yourPointsHistory') || 'Your Points History'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noPointsTransactionsYet') || 'No points transactions yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('points') || 'Points'}</TableHead>
                    <TableHead>{t('reason') || 'Reason'}</TableHead>
                    <TableHead>{t('occurrenceDate') || 'Occurrence Date'}</TableHead>
                    <TableHead>{t('awardedBy') || 'Awarded By'}</TableHead>
                    <TableHead>{t('date') || 'Date'}</TableHead>
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
