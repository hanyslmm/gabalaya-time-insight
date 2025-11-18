import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Save, X, Edit, FileText, Shield, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import MobilePageWrapper from '@/components/MobilePageWrapper';
import WorkRegulationEditor from '@/components/WorkRegulationEditor';
import { cn } from '@/lib/utils';

interface WorkRegulation {
  id: string;
  organization_id: string;
  title: string;
  subtitle: string | null;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const WorkRegulationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
  
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);

  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner';

  // Fetch work regulations
  const { data: regulation, isLoading } = useQuery<WorkRegulation | null>({
    queryKey: ['work-regulations', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_regulations')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      return data || null;
    }
  });

  // Update regulation mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !content.trim()) {
        throw new Error(t('titleAndContentRequired') || 'Title and content are required');
      }

      if (regulation) {
        // Update existing
        const { error } = await supabase
          .from('work_regulations')
          .update({
            title: title.trim(),
            subtitle: subtitle.trim() || null,
            content: content.trim(),
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', regulation.id);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('work_regulations')
          .insert({
            organization_id: activeOrganizationId,
            title: title.trim(),
            subtitle: subtitle.trim() || null,
            content: content.trim(),
            is_active: isActive,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-regulations', activeOrganizationId] });
      setIsEditing(false);
      toast.success(t('workRegulationSaved') || 'Work regulation saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorSavingWorkRegulation') || 'Failed to save work regulation');
    }
  });

  const handleEdit = () => {
    if (regulation) {
      setTitle(regulation.title);
      setSubtitle(regulation.subtitle || '');
      setContent(regulation.content);
      setIsActive(regulation.is_active);
    } else {
      setTitle('');
      setSubtitle('');
      setContent('');
      setIsActive(true);
    }
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (regulation) {
      setTitle(regulation.title);
      setSubtitle(regulation.subtitle || '');
      setContent(regulation.content);
      setIsActive(regulation.is_active);
    }
  };

  if (isLoading) {
    return (
      <MobilePageWrapper>
        <div className="container mx-auto p-4">
          <p className="text-muted-foreground">{t('loading') || 'Loading...'}</p>
        </div>
      </MobilePageWrapper>
    );
  }

  return (
    <MobilePageWrapper>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t('workRegulations') || 'Work Regulations'}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('workRegulationsDescription') || 'View and manage organization work regulations'}
              </p>
            </div>
          </div>
          {isAdminOrOwner && !isEditing && (
            <Button onClick={handleEdit} className="gap-2">
              <Edit className="h-4 w-4" />
              {regulation ? (t('edit') || 'Edit') : (t('create') || 'Create')}
            </Button>
          )}
        </div>

        {/* Edit Mode */}
        {isEditing && isAdminOrOwner ? (
          <Card className="border-2 border-primary/30 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Edit className="h-5 w-5 text-primary" />
                </div>
                {regulation ? (t('editWorkRegulation') || 'Edit Work Regulation') : (t('createWorkRegulation') || 'Create Work Regulation')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="title" className="text-base font-semibold">{t('title') || 'Title'} *</Label>
                  <Badge variant={title.length >= 150 ? "destructive" : "secondary"} className="text-xs">
                    {title.length} / 200 {t('characters') || 'characters'}
                  </Badge>
                </div>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => {
                    if (e.target.value.length <= 200) {
                      setTitle(e.target.value);
                    }
                  }}
                  placeholder={t('enterTitle') || 'Enter title'}
                  className={cn(
                    "text-lg font-semibold h-12 border-2 focus:border-primary/50 transition-colors",
                    title.length >= 180 && "border-amber-500/50"
                  )}
                  maxLength={200}
                />
                {title.length >= 180 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {t('approachingLimit') || 'Approaching character limit'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="subtitle" className="text-base font-semibold">{t('subtitle') || 'Subtitle'}</Label>
                  <Badge variant={subtitle.length >= 150 ? "destructive" : "secondary"} className="text-xs">
                    {subtitle.length} / 200 {t('characters') || 'characters'}
                  </Badge>
                </div>
                <Input
                  id="subtitle"
                  value={subtitle}
                  onChange={(e) => {
                    if (e.target.value.length <= 200) {
                      setSubtitle(e.target.value);
                    }
                  }}
                  placeholder={t('enterSubtitle') || 'Enter subtitle (optional)'}
                  className={cn(
                    "h-11 border-2 focus:border-primary/50 transition-colors",
                    subtitle.length >= 180 && "border-amber-500/50"
                  )}
                  maxLength={200}
                />
                {subtitle.length >= 180 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {t('approachingLimit') || 'Approaching character limit'}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{t('content') || 'Content'} *</Label>
                  {content && (
                    <Badge variant="secondary" className="text-xs">
                      {content.length} {t('characters') || 'characters'}
                    </Badge>
                  )}
                </div>
                <div className="border-2 rounded-xl p-6 bg-gradient-to-br from-background to-muted/20 shadow-inner">
                  <WorkRegulationEditor
                    content={content}
                    onChange={(htmlContent) => setContent(htmlContent)}
                  />
                </div>
                <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('contentEditorHint') || 'Add sections and items using the buttons. Use "Bold Text: rest of text" format for items with bold labels.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <Label htmlFor="active">{t('active') || 'Active'}</Label>
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              <div className="flex gap-3 pt-6 border-t-2">
                <Button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !title.trim() || !content.trim()}
                  className="flex-1 gap-2 h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
                >
                  <Save className="h-5 w-5" />
                  {updateMutation.isPending ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleCancel} 
                  className="flex-1 gap-2 h-12 text-base font-medium border-2 hover:bg-destructive/10 hover:border-destructive/50 transition-colors"
                >
                  <X className="h-5 w-5" />
                  {t('cancel') || 'Cancel'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* View Mode */
          <>
            {regulation ? (
              <Card className="overflow-hidden border-2 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 pb-6">
                  <div className="space-y-2">
                    <CardTitle className="text-3xl md:text-4xl font-bold text-center">
                      {regulation.title}
                    </CardTitle>
                    {regulation.subtitle && (
                      <p className="text-lg md:text-xl text-center text-muted-foreground font-medium">
                        {regulation.subtitle}
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6 md:p-8">
                  <div 
                    className="prose prose-lg dark:prose-invert max-w-none work-regulations-content"
                    dangerouslySetInnerHTML={{ __html: regulation.content }}
                    style={{
                      direction: 'rtl',
                      textAlign: 'right',
                    }}
                  />
                  <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} {t('allRightsReserved') || 'All rights reserved'}.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                  <div className="p-4 bg-muted rounded-full">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold">{t('noWorkRegulations') || 'No Work Regulations'}</h3>
                    <p className="text-muted-foreground">
                      {isAdminOrOwner 
                        ? t('noWorkRegulationsAdmin') || 'No work regulations have been created yet. Click "Create" to add one.'
                        : t('noWorkRegulationsEmployee') || 'No work regulations are available at this time.'}
                    </p>
                  </div>
                  {isAdminOrOwner && (
                    <Button onClick={handleEdit} className="gap-2 mt-4">
                      <FileText className="h-4 w-4" />
                      {t('create') || 'Create'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </MobilePageWrapper>
  );
};

export default WorkRegulationsPage;

