import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface PointsLogEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logId: string;
  initialPoints: number;
  initialReason: string;
  initialOccurrenceDate: string;
  initialNotes?: string | null;
}

const PointsLogEditDialog: React.FC<PointsLogEditDialogProps> = ({
  open,
  onOpenChange,
  logId,
  initialPoints,
  initialReason,
  initialOccurrenceDate,
  initialNotes
}) => {
  const queryClient = useQueryClient();
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<string>('');
  const [occurrenceDate, setOccurrenceDate] = useState<Date>(new Date(initialOccurrenceDate));
  const [notes, setNotes] = useState<string>(initialNotes || '');

  React.useEffect(() => {
    if (open) {
      setSelectedCatalogItem('');
      setOccurrenceDate(new Date(initialOccurrenceDate));
      setNotes(initialNotes || '');
    }
  }, [open, initialPoints, initialReason, initialOccurrenceDate, initialNotes]);

  const { data: catalogItems = [] } = useQuery<any[]>({
    queryKey: ['points-catalog-edit'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('points_catalog')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: false })
        .order('points', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const selectedItem = catalogItems.find((i) => i.id === selectedCatalogItem);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCatalogItem) throw new Error('Select a catalog item');
      const { data, error } = await supabase.rpc('update_points_log_entry' as any, {
        p_log_id: logId,
        p_catalog_item_id: selectedCatalogItem,
        p_new_occurrence_date: format(occurrenceDate, 'yyyy-MM-dd'),
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Failed to update log');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points-log-recent'] });
      queryClient.invalidateQueries({ queryKey: ['organization-points-budget'] });
      onOpenChange(false);
    },
    onError: () => {},
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('delete_points_log_entry' as any, { p_log_id: logId });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Failed to delete log');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points-log-recent'] });
      queryClient.invalidateQueries({ queryKey: ['organization-points-budget'] });
      onOpenChange(false);
    },
    onError: () => {},
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Points Log</DialogTitle>
          <DialogDescription>Adjust points, reason, and occurrence date.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Select from Catalog</Label>
            <Select value={selectedCatalogItem || 'none'} onValueChange={(v) => setSelectedCatalogItem(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a catalog item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {catalogItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label} <Badge className="ml-2" variant="outline">{item.points > 0 ? '+' : ''}{item.points}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedItem && (
            <div className="space-y-2">
              <Label>Points</Label>
              <div className="text-sm">
                <Badge variant="outline">{selectedItem.points > 0 ? '+' : ''}{selectedItem.points}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{selectedItem.description || ''}</div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="date">Occurrence Date</Label>
            <Input id="date" type="date" value={format(occurrenceDate, 'yyyy-MM-dd')} onChange={(e) => setOccurrenceDate(new Date(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>Delete</Button>
            <Button type="submit" disabled={updateMutation.isPending || !selectedCatalogItem}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PointsLogEditDialog;
