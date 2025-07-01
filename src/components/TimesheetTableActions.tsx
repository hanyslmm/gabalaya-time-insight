
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

interface TimesheetTableActionsProps {
  selectedRowsCount: number;
  onDeleteSelected: () => void;
  isDeleting: boolean;
}

const TimesheetTableActions: React.FC<TimesheetTableActionsProps> = ({
  selectedRowsCount,
  onDeleteSelected,
  isDeleting
}) => {
  const { t } = useTranslation();

  if (selectedRowsCount === 0) return null;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isDeleting}>
          <Trash2 className="h-4 w-4 mr-2" />
          {t('deleteSelected') || 'Delete Selected'} ({selectedRowsCount})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('confirmDelete') || 'Confirm Delete'}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteConfirmation') || `Are you sure you want to delete ${selectedRowsCount} selected entries? This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel') || 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction onClick={onDeleteSelected} className="bg-red-600 hover:bg-red-700">
            {t('delete') || 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default TimesheetTableActions;
