import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BarChart3, PieChart as PieChartIcon, Edit, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DataPoint {
  id: string;
  name: string;
  value: number;
  description?: string;
  color?: string;
}

interface ClickableChartProps {
  title: string;
  description?: string;
  data: DataPoint[];
  type: 'bar' | 'pie';
  onDataUpdate?: (data: DataPoint[]) => void;
  allowEdit?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const ClickableChart: React.FC<ClickableChartProps> = ({
  title,
  description,
  data,
  type,
  onDataUpdate,
  allowEdit = true
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingData, setEditingData] = useState<DataPoint[]>(data);
  const [selectedItem, setSelectedItem] = useState<DataPoint | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleBarClick = (data: any) => {
    const item = editingData.find(d => d.name === data.name);
    if (item) {
      handleItemClick(item);
    }
  };

  const handlePieClick = (data: any) => {
    const item = editingData.find(d => d.name === data.name);
    if (item) {
      handleItemClick(item);
    }
  };

  const handleItemClick = (item: DataPoint) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (onDataUpdate) {
      onDataUpdate(editingData);
    }
    setIsEditMode(false);
    toast({
      title: "Changes saved",
      description: "Chart data has been updated successfully.",
    });
  };

  const handleAddItem = () => {
    const newItem: DataPoint = {
      id: Date.now().toString(),
      name: 'New Item',
      value: 0,
      description: '',
      color: COLORS[editingData.length % COLORS.length]
    };
    setEditingData([...editingData, newItem]);
  };

  const handleUpdateItem = (id: string, updates: Partial<DataPoint>) => {
    setEditingData(prev => 
      prev.map(item => item.id === id ? { ...item, ...updates } : item)
    );
  };

  const handleDeleteItem = (id: string) => {
    setEditingData(prev => prev.filter(item => item.id !== id));
  };

  const renderChart = () => {
    if (type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={editingData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar 
              dataKey="value" 
              fill="hsl(var(--primary))" 
              onClick={handleBarClick}
              style={{ cursor: 'pointer' }}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={editingData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              onClick={handlePieClick}
              style={{ cursor: 'pointer' }}
            >
              {editingData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      );
    }
  };

  return (
    <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/30 shadow-card hover:shadow-elegant transition-all duration-300 rounded-xl overflow-hidden card-interactive">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5 border-b border-border/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
              {type === 'bar' ? <BarChart3 className="h-5 w-5 text-primary" /> : <PieChartIcon className="h-5 w-5 text-primary" />}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-fluid-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent break-words-enhanced line-clamp-2">
                {title}
              </CardTitle>
              {description && (
                <CardDescription className="text-fluid-sm text-muted-foreground font-medium break-words-enhanced line-clamp-2 mt-1">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          {allowEdit && (
            <div className="flex gap-2 flex-shrink-0">
              {isEditMode ? (
                <>
                  <Button size="sm" onClick={handleSave} className="bg-success text-success-foreground hover:bg-success/90">
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditingData(data);
                    setIsEditMode(false);
                  }} className="hover:bg-muted/50">
                    Cancel
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setIsEditMode(true)} className="hover:bg-primary/10 hover:border-primary/50">
                  <Edit className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {renderChart()}
        
        {isEditMode && (
          <div className="mt-6 space-y-4 border-t border-border/30 pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h4 className="font-semibold text-foreground text-fluid-base">Edit Data Points</h4>
              <Button size="sm" onClick={handleAddItem} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto mobile-scroll">
              {editingData.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-background/50 rounded-lg border border-border/30 hover:bg-background/70 transition-colors">
                  <Input
                    value={item.name}
                    onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                    placeholder="Name"
                    className="flex-1 min-w-0"
                  />
                  <Input
                    type="number"
                    value={item.value}
                    onChange={(e) => handleUpdateItem(item.id, { value: Number(e.target.value) })}
                    placeholder="Value"
                    className="w-full sm:w-24"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteItem(item.id)}
                    className="hover:bg-destructive/90 w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="ml-2 sm:hidden">Delete</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                {type === 'bar' ? <BarChart3 className="h-5 w-5 text-primary" /> : <PieChartIcon className="h-5 w-5 text-primary" />}
              </div>
              {selectedItem?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={selectedItem?.name || ''}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  value={selectedItem?.value || 0}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
            </div>
            {selectedItem?.description && (
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={selectedItem.description}
                  readOnly
                  className="bg-muted/50 resize-none"
                  rows={3}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ClickableChart;