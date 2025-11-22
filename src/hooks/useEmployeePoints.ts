import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface EmployeePointsData {
  totalPoints: number;
  level: string;
  bonusEGP: number;
  organizationId: string;
  isPointsSystemActive: boolean;
}

export const useEmployeePoints = (employeeId: string | null | undefined) => {
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

  return useQuery<EmployeePointsData | null>({
    queryKey: ['employee-points', employeeId, activeOrganizationId],
    enabled: !!employeeId && !!activeOrganizationId,
    queryFn: async () => {
      if (!employeeId || !activeOrganizationId) return null;

      // Check if points system is active for organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('is_points_system_active')
        .eq('id', activeOrganizationId)
        .single();

      if (orgError || !orgData) {
        return null;
      }

      const isActive = (orgData as any).is_points_system_active;
      if (!isActive) {
        return null; // Points system not active
      }

      // Get employee's total points
      console.log('useEmployeePoints: Fetching points for employee:', employeeId);
      const { data: pointsData, error: pointsError } = await supabase.rpc(
        'get_employee_total_points' as any,
        { p_employee_id: employeeId }
      );

      console.log('useEmployeePoints: RPC response:', { pointsData, pointsError });

      if (pointsError) {
        console.error('Error fetching employee points:', pointsError);
        return null;
      }

      const totalPoints = pointsData || 0;
      console.log('useEmployeePoints: Total points calculated:', totalPoints);

      // Get employee level
      const { data: levelData } = await supabase.rpc(
        'get_employee_level' as any,
        { p_employee_id: employeeId }
      );

      // Get bonus in EGP
      const { data: bonusData } = await supabase.rpc(
        'get_employee_points_bonus_egp' as any,
        { p_employee_id: employeeId }
      );

      return {
        totalPoints,
        level: levelData || 'Starter',
        bonusEGP: bonusData || 0,
        organizationId: activeOrganizationId,
        isPointsSystemActive: true
      };
    }
  });
};

export const useOrganizationPointsBudget = () => {
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

  return useQuery<{ budget: number; pointValue: number } | null>({
    queryKey: ['organization-points-budget', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      if (!activeOrganizationId) return null;

      const { data, error } = await supabase
        .from('organizations')
        .select('points_budget, point_value')
        .eq('id', activeOrganizationId)
        .single();

      if (error) {
        console.error('Error fetching budget:', error);
        return null;
      }

      return {
        budget: (data as any).points_budget || 0,
        pointValue: Number((data as any).point_value) || 5
      };
    }
  });
};
