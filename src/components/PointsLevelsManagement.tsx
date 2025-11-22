import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Trophy, Plus, Edit2, Trash2, Save, X, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PointsLevel {
  id: string;
  level_name: string;
  min_points: number;
  max_points: number | null;
  display_order: number;
  is_active: boolean;
}

const PointsLevelsManagement: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPoints, setEditPoints] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newLevelName, setNewLevelName] = useState('');
  const [newLevelPoints, setNewLevelPoints] = useState('');

  // Fetch levels
  const { data: levels = [], isLoading, refetch } = useQuery<PointsLevel[]>({
    queryKey: ['points-levels', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      console.log('Fetching levels for organization:', activeOrganizationId);
      
      const { data, error } = await (supabase as any)
        .from('points_levels')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('display_order', { ascending: true });
      
      if (error) {
        console.error('Error fetching levels:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return [];
      }
      
      console.log('Levels fetched successfully:', data);
      return (data || []) as PointsLevel[];
    }
  });

  // Auto-seed default levels on first load if none exist
  React.useEffect(() => {
    if (!isLoading && levels.length === 0 && activeOrganizationId && !seedDefaultLevelsMutation.isPending) {
      console.log('Auto-seeding default levels...');
      seedDefaultLevelsMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, levels.length, activeOrganizationId]);

  // Seed default levels mutation
  const seedDefaultLevelsMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrganizationId) throw new Error('No organization selected');
      
      console.log('Seeding default levels for organization:', activeOrganizationId);
      
      // Directly insert default levels instead of using RPC
      const defaultLevels = [
        { level_name: 'Starter', min_points: 0, display_order: 1 },
        { level_name: 'Rising Star', min_points: 25, display_order: 2 },
        { level_name: 'Champion', min_points: 50, display_order: 3 },
        { level_name: 'Legend', min_points: 100, display_order: 4 }
      ];

      const levelsToInsert = defaultLevels.map(level => ({
        organization_id: activeOrganizationId,
        level_name: level.level_name,
        min_points: level.min_points,
        max_points: null, // Will be calculated automatically
        display_order: level.display_order,
        is_active: true
      }));

      console.log('Inserting levels:', levelsToInsert);

      const { data, error } = await (supabase as any)
        .from('points_levels')
        .insert(levelsToInsert)
        .select();
      
      if (error) {
        console.error('Error inserting levels:', error);
        throw error;
      }
      
      console.log('Levels inserted successfully:', data);
      return data;
    },
    onSuccess: async (data) => {
      console.log('Seed mutation success, refetching...');
      await queryClient.invalidateQueries({ queryKey: ['points-levels', activeOrganizationId] });
      await queryClient.invalidateQueries({ queryKey: ['employee-points'] });
      await refetch();
      toast({
        title: t('defaultLevelsSeeded') || 'Default levels created',
        description: t('defaultLevelsSeededDescription') || 'You can now edit or delete them as needed.',
        variant: 'default'
      });
    },
    onError: (error: any) => {
      console.error('Seed error:', error);
      toast({
        title: t('error') || 'Error',
        description: error.message || 'Failed to create default levels',
        variant: 'destructive'
      });
    }
  });

  // Save/Update level mutation
  const saveLevelMutation = useMutation({
    mutationFn: async ({ id, name, points, isNew }: { id?: string; name: string; points: number; isNew?: boolean }) => {
      if (!activeOrganizationId) throw new Error('No organization selected');
      if (!name.trim()) throw new Error('Level name is required');
      if (points < 0) throw new Error('Points must be 0 or greater');

      // Calculate max_points based on display order
      const sortedLevels = [...levels].sort((a, b) => a.min_points - b.min_points);
      
      if (isNew) {
        // Find the position where this level should be inserted
        const nextLevel = sortedLevels.find(l => l.min_points > points);
        const displayOrder = nextLevel ? nextLevel.display_order : levels.length + 1;

        const { error } = await (supabase as any)
          .from('points_levels')
          .insert({
            organization_id: activeOrganizationId,
            level_name: name.trim(),
            min_points: points,
            max_points: null,
            display_order: displayOrder,
            is_active: true
          });
        
        if (error) throw error;

        // Update display orders
        if (nextLevel) {
          for (let i = 0; i < sortedLevels.length; i++) {
            if (sortedLevels[i].min_points >= points && sortedLevels[i].id !== id) {
              await (supabase as any)
                .from('points_levels')
                .update({ display_order: sortedLevels[i].display_order + 1 })
                .eq('id', sortedLevels[i].id);
            }
          }
        }
      } else {
        // Update existing level
        const { error } = await (supabase as any)
          .from('points_levels')
          .update({
            level_name: name.trim(),
            min_points: points
          })
          .eq('id', id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points-levels', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['employee-points'] });
      toast({
        title: t('success') || 'Success',
        description: 'Level saved successfully',
        variant: 'default'
      });
      setEditingId(null);
      setIsAddingNew(false);
      setNewLevelName('');
      setNewLevelPoints('');
    },
    onError: (error: any) => {
      toast({
        title: t('error') || 'Error',
        description: error.message || 'Failed to save level',
        variant: 'destructive'
      });
    }
  });

  // Delete level mutation
  const deleteLevelMutation = useMutation({
    mutationFn: async (levelId: string) => {
      const { error } = await (supabase as any)
        .from('points_levels')
        .delete()
        .eq('id', levelId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points-levels', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['employee-points'] });
      toast({
        title: t('success') || 'Success',
        description: 'Level deleted successfully',
        variant: 'default'
      });
    },
    onError: () => {
      toast({
        title: t('error') || 'Error',
        description: 'Failed to delete level',
        variant: 'destructive'
      });
    }
  });

  const startEdit = (level: PointsLevel) => {
    setEditingId(level.id);
    setEditName(level.level_name);
    setEditPoints(level.min_points.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditPoints('');
  };

  const saveEdit = (id: string) => {
    const points = parseInt(editPoints);
    if (!isNaN(points)) {
      saveLevelMutation.mutate({ id, name: editName, points, isNew: false });
    }
  };

  const addNewLevel = () => {
    const points = parseInt(newLevelPoints);
    if (newLevelName.trim() && !isNaN(points)) {
      saveLevelMutation.mutate({ name: newLevelName, points, isNew: true });
    }
  };

  const sortedLevels = [...levels].sort((a, b) => a.min_points - b.min_points);

  // Debug logging
  React.useEffect(() => {
    console.log('PointsLevelsManagement render:', { 
      levelsCount: levels.length, 
      sortedLevelsCount: sortedLevels.length,
      isLoading,
      seedingPending: seedDefaultLevelsMutation.isPending,
      levels 
    });
  }, [levels, sortedLevels, isLoading, seedDefaultLevelsMutation.isPending]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              {t('pointsLevelsManagement') || 'Points Levels Management'}
            </CardTitle>
            <CardDescription>
              {t('simplifiedLevelsDescription') || 'Set level names and points required to reach them'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {sortedLevels.length > 0 && (
              <>
                <Button onClick={() => refetch()} size="sm" variant="ghost" title="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button onClick={() => setIsAddingNew(!isAddingNew)} size="sm" variant={isAddingNew ? "outline" : "default"}>
                  {isAddingNew ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {isAddingNew ? t('cancel') : t('addLevel') || 'Add Level'}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 animate-pulse text-yellow-600/50 dark:text-yellow-400/50" />
            {t('loading')}
          </div>
        ) : seedDefaultLevelsMutation.isPending ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 animate-bounce text-yellow-600 dark:text-yellow-400" />
            {t('creatingDefaultLevels') || 'Creating default levels...'}
          </div>
        ) : sortedLevels.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-yellow-600/50 dark:text-yellow-400/50" />
            <p className="text-muted-foreground mb-4">{t('noLevelsConfigured') || 'No levels configured yet.'}</p>
            <Button 
              onClick={() => seedDefaultLevelsMutation.mutate()} 
              className="bg-primary hover:bg-primary/90"
              disabled={seedDefaultLevelsMutation.isPending}
            >
              <Trophy className="h-4 w-4 mr-2" />
              {t('seedDefaultLevels') || 'Create Default Levels'}
            </Button>
            <p className="text-xs mt-4 text-muted-foreground">
              {t('seedDefaultLevelsHint') || 'Creates: Starter (0), Rising Star (25), Champion (50), Legend (100)'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Add New Level Form */}
            {isAddingNew && (
              <div className="border-2 border-dashed border-primary/50 rounded-lg p-4 bg-primary/5">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-1">
                    <Badge variant="outline" className="text-sm">
                      New
                    </Badge>
                  </div>
                  <div className="md:col-span-5">
                    <Label htmlFor="new-level-name" className="text-xs mb-1">{t('levelName')}</Label>
                    <Input
                      id="new-level-name"
                      value={newLevelName}
                      onChange={(e) => setNewLevelName(e.target.value)}
                      placeholder={t('enterLevelName') || 'e.g., Elite, Master'}
                      className="h-9"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Label htmlFor="new-level-points" className="text-xs mb-1">{t('pointsNeeded')}</Label>
                    <Input
                      id="new-level-points"
                      type="number"
                      value={newLevelPoints}
                      onChange={(e) => setNewLevelPoints(e.target.value)}
                      placeholder="e.g., 75"
                      min="0"
                      className="h-9"
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <Button
                      onClick={addNewLevel}
                      disabled={!newLevelName.trim() || !newLevelPoints || saveLevelMutation.isPending}
                      size="sm"
                      className="flex-1"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => {
                        setIsAddingNew(false);
                        setNewLevelName('');
                        setNewLevelPoints('');
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Existing Levels */}
            <div className="space-y-2">
              {sortedLevels.map((level, index) => (
                <div
                  key={level.id}
                  className={cn(
                    "border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors",
                    editingId === level.id && "border-primary bg-primary/5"
                  )}
                >
                  {editingId === level.id ? (
                    // Edit Mode
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-1">
                        <Badge variant="secondary" className="text-sm">
                          #{index + 1}
                        </Badge>
                      </div>
                      <div className="md:col-span-5">
                        <Label htmlFor={`edit-name-${level.id}`} className="text-xs mb-1">{t('levelName')}</Label>
                        <Input
                          id={`edit-name-${level.id}`}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label htmlFor={`edit-points-${level.id}`} className="text-xs mb-1">{t('pointsNeeded')}</Label>
                        <Input
                          id={`edit-points-${level.id}`}
                          type="number"
                          value={editPoints}
                          onChange={(e) => setEditPoints(e.target.value)}
                          min="0"
                          className="h-9"
                        />
                      </div>
                      <div className="md:col-span-2 flex gap-2">
                        <Button
                          onClick={() => saveEdit(level.id)}
                          disabled={saveLevelMutation.isPending}
                          size="sm"
                          className="flex-1"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={cancelEdit}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-sm">
                          #{index + 1}
                        </Badge>
                        <div className="flex-1">
                          <div className="font-semibold text-lg">{level.level_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {level.min_points} {t('points')} 
                            <span className="mx-1">•</span>
                            {index < sortedLevels.length - 1 
                              ? `${level.min_points}-${sortedLevels[index + 1].min_points - 1}`
                              : `${level.min_points}+`
                            }
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => startEdit(level)}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            <span className="hidden sm:inline">{t('edit')}</span>
                          </Button>
                          <Button
                            onClick={() => deleteLevelMutation.mutate(level.id)}
                            variant="outline"
                            size="sm"
                            disabled={deleteLevelMutation.isPending}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="hidden sm:inline">{t('delete')}</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PointsLevelsManagement;
