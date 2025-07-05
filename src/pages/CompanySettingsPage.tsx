
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Save, Settings } from 'lucide-react';

const CompanySettingsPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  // Fetch current motivational message
  const { data: currentMessage, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('motivational_message')
        .single();

      if (error && error.code !== 'PGRST116') {
        // If no settings exist, return default
        return { motivational_message: "Keep up the great work! Your dedication and effort make a real difference to our team." };
      }
      
      return data || { motivational_message: "Keep up the great work! Your dedication and effort make a real difference to our team." };
    },
    onSuccess: (data) => {
      setMessage(data.motivational_message || '');
    }
  });

  // Save motivational message
  const saveMutation = useMutation({
    mutationFn: async (newMessage: string) => {
      const { data, error } = await supabase
        .from('company_settings')
        .upsert({ 
          id: 1, // Use a fixed ID for singleton settings
          motivational_message: newMessage 
        }, {
          onConflict: 'id'
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Employee motivational message has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      queryClient.invalidateQueries({ queryKey: ['motivational-message'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
      console.error('Save error:', error);
    }
  });

  const handleSave = () => {
    if (message.trim()) {
      saveMutation.mutate(message.trim());
    }
  };

  React.useEffect(() => {
    if (currentMessage?.motivational_message) {
      setMessage(currentMessage.motivational_message);
    }
  }, [currentMessage]);

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Company Settings</h1>
          <p className="mt-2 text-muted-foreground">Manage company-wide settings and messages</p>
        </div>
        
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-32 bg-muted/20 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Company Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage company-wide settings and messages</p>
      </div>

      <div className="max-w-2xl">
        <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              Employee Motivational Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="motivational-message">
                Message to Display on Employee Timesheet Page
              </Label>
              <Textarea
                id="motivational-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter a motivational message for your employees..."
                className="min-h-[120px] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {message.length}/500 characters
              </p>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-medium text-sm text-foreground mb-2">Preview:</h4>
              <p className="text-muted-foreground italic">
                "{message || 'Your motivational message will appear here...'}"
              </p>
            </div>

            <div className="flex justify-end gap-4">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || !message.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save Message'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 bg-gradient-to-br from-card via-card to-muted/5 border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-muted/20 rounded-lg">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </div>
              Additional Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              More company settings and configuration options will be available here in future updates.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanySettingsPage;
