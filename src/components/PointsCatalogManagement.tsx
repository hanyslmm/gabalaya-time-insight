import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Plus, Edit, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PointsCatalogItem {
  id: string;
  label: string;
  points: number;
  category: 'reward' | 'penalty';
  is_active: boolean;
  description?: string;
}

const PointsCatalogManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PointsCatalogItem | null>(null);
  const [formData, setFormData] = useState({
    label: '',
    points: '',
    category: 'reward' as 'reward' | 'penalty',
    description: '',
    is_active: true
  });

  const { data: catalogItems = [], isLoading } = useQuery<PointsCatalogItem[]>({
    queryKey: ['points-catalog', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('points_catalog')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('category', { ascending: false })
        .order('points', { ascending: false });
      
      if (error) throw error;
      return data as PointsCatalogItem[];
    }
  });

  const canManage = (user?.role === 'admin' || user?.role === 'owner') && !!activeOrganizationId;

  const resetForm = () => {
    setFormData({
      label: '',
      points: '',
      category: 'reward',
      description: '',
      is_active: true
    });
    setEditingItem(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: PointsCatalogItem) => {
    setEditingItem(item);
    setFormData({
      label: item.label,
      points: item.points.toString(),
      category: item.category,
      description: item.description || '',
      is_active: item.is_active
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!activeOrganizationId) {
        throw new Error('Please select an organization first');
      }

      const pointsValue = parseInt(data.points);
      if (isNaN(pointsValue)) {
        throw new Error('Points must be a valid number');
      }

      // Validate: rewards should be positive, penalties should be negative
      if (data.category === 'reward' && pointsValue <= 0) {
        throw new Error('Rewards must have positive points');
      }
      if (data.category === 'penalty' && pointsValue >= 0) {
        throw new Error('Penalties must have negative points');
      }

      if (editingItem) {
        // Update existing item
        const { data: updated, error } = await supabase
          .from('points_catalog')
          .update({
            label: data.label.trim(),
            points: pointsValue,
            category: data.category,
            description: data.description.trim() || null,
            is_active: data.is_active
          })
          .eq('id', editingItem.id)
          .select()
          .single();

        if (error) throw error;
        return updated;
      } else {
        // Insert new item
        const { data: inserted, error } = await supabase
          .from('points_catalog')
          .insert({
            organization_id: activeOrganizationId,
            label: data.label.trim(),
            points: pointsValue,
            category: data.category,
            description: data.description.trim() || null,
            is_active: data.is_active
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error('A catalog item with this label already exists');
          }
          throw error;
        }
        return inserted;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points-catalog', activeOrganizationId] });
      toast.success(editingItem ? 'Catalog item updated successfully' : 'Catalog item added successfully');
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save catalog item');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('points_catalog')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points-catalog', activeOrganizationId] });
      toast.success('Catalog item deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete catalog item');
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('points_catalog')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points-catalog', activeOrganizationId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update catalog item');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const rewards = catalogItems.filter(item => item.category === 'reward');
  const penalties = catalogItems.filter(item => item.category === 'penalty');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            Points Catalog
          </CardTitle>
          {canManage && (
            <Button onClick={openAddDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading catalog...</div>
        ) : catalogItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No catalog items yet.</p>
            {canManage && (
              <Button onClick={openAddDialog} className="mt-4" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Item
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Rewards Section */}
            {rewards.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">Rewards</Badge>
                  <span className="text-muted-foreground text-sm">({rewards.length} items)</span>
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        {canManage && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rewards.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.label}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
                              +{item.points}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.description || '-'}
                          </TableCell>
                          <TableCell>
                            {canManage ? (
                              <Switch
                                checked={item.is_active}
                                onCheckedChange={(checked) => 
                                  toggleActiveMutation.mutate({ id: item.id, is_active: checked })
                                }
                                disabled={toggleActiveMutation.isPending}
                              />
                            ) : (
                              <Badge variant={item.is_active ? 'default' : 'secondary'}>
                                {item.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            )}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(item)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteMutation.mutate(item.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Penalties Section */}
            {penalties.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="destructive">Penalties</Badge>
                  <span className="text-muted-foreground text-sm">({penalties.length} items)</span>
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        {canManage && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {penalties.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.label}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300">
                              {item.points}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.description || '-'}
                          </TableCell>
                          <TableCell>
                            {canManage ? (
                              <Switch
                                checked={item.is_active}
                                onCheckedChange={(checked) => 
                                  toggleActiveMutation.mutate({ id: item.id, is_active: checked })
                                }
                                disabled={toggleActiveMutation.isPending}
                              />
                            ) : (
                              <Badge variant={item.is_active ? 'default' : 'secondary'}>
                                {item.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            )}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(item)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteMutation.mutate(item.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Catalog Item' : 'Add Catalog Item'}</DialogTitle>
            <DialogDescription>
              {editingItem 
                ? 'Update the points catalog item details.'
                : 'Create a new reward or penalty item for the points system.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="label">Label *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="e.g., Emergency Shift"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: 'reward' | 'penalty') => 
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reward">Reward</SelectItem>
                      <SelectItem value="penalty">Penalty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="points">Points *</Label>
                  <Input
                    id="points"
                    type="number"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                    placeholder={formData.category === 'reward' ? '5' : '-4'}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.category === 'reward' ? 'Must be positive' : 'Must be negative'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : editingItem ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PointsCatalogManagement;

