
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface TimesheetUploadProps {
  onClose: () => void;
  onUploadComplete: () => void;
}

const TimesheetUpload: React.FC<TimesheetUploadProps> = ({ onClose, onUploadComplete }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (timesheetData: any[]) => {
      const { data, error } = await supabase
        .from('timesheet_entries')
        .insert(timesheetData);
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('timesheetUploaded') || 'Timesheet uploaded successfully');
      onUploadComplete();
      onClose();
    },
    onError: (error) => {
      console.error('Error uploading timesheet:', error);
      toast.error(t('errorUploadingTimesheet') || 'Error uploading timesheet');
    }
  });

  const parseFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'csv') {
        Papa.parse(file, {
          header: true,
          complete: (results) => {
            resolve(results.data);
          },
          error: (error) => {
            reject(error);
          }
        });
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            resolve(jsonData);
          } catch (error) {
            reject(error);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Unsupported file format'));
      }
    });
  };

  const processTimesheetData = (rawData: any[]): any[] => {
    return rawData.map((row: any) => {
      // Calculate total hours (basic calculation for now)
      const clockInTime = new Date(`${row['Clock in date']} ${row['Clock in time']}`);
      const clockOutTime = new Date(`${row['Clock out date']} ${row['Clock out time']}`);
      const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
      
      return {
        employee_name: row['Name'] || row['Employee Name'] || 'Unknown',
        clock_in_date: row['Clock in date'],
        clock_in_time: row['Clock in time'],
        clock_out_date: row['Clock out date'],
        clock_out_time: row['Clock out time'],
        total_hours: Math.max(0, totalHours),
        total_card_amount_flat: Math.max(0, totalHours) * 20, // Default 20 LE/hr
        break_start: row['Break start'] || null,
        break_end: row['Break end'] || null,
        break_length: row['Break length'] || null,
        break_type: row['Break type'] || null,
        payroll_id: row['Payroll ID'] || null,
        actual_hours: row['Actual hours'] || null,
        no_show_reason: row['No show reason'] || null,
        employee_note: row['Employee note'] || null,
        manager_note: row['Manager note'] || null,
        is_split_calculation: false
      };
    });
  };

  const handleFileUpload = async () => {
    if (!file) {
      toast.error(t('selectFile') || 'Please select a file');
      return;
    }

    setUploading(true);
    try {
      const rawData = await parseFile(file);
      const processedData = processTimesheetData(rawData);
      
      if (processedData.length === 0) {
        toast.error(t('noValidData') || 'No valid data found in file');
        return;
      }

      uploadMutation.mutate(processedData);
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error(t('errorProcessingFile') || 'Error processing file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {t('uploadTimesheet') || 'Upload Timesheet'}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('selectFile') || 'Select File'} (CSV, Excel)
            </label>
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          
          {file && (
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                <strong>{t('selectedFile') || 'Selected file'}:</strong> {file.name}
              </p>
              <p className="text-sm text-gray-500">
                {t('fileSize') || 'Size'}: {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          )}
          
          <div className="flex space-x-2">
            <Button
              onClick={handleFileUpload}
              disabled={!file || uploading || uploadMutation.isPending}
              className="flex-1 flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>
                {uploading || uploadMutation.isPending 
                  ? (t('uploading') || 'Uploading...') 
                  : (t('upload') || 'Upload')
                }
              </span>
            </Button>
            <Button variant="outline" onClick={onClose}>
              {t('cancel') || 'Cancel'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TimesheetUpload;
