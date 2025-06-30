
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
          skipEmptyLines: true,
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
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // Find the header row (skip empty rows)
            let headerRowIndex = -1;
            for (let i = 0; i < jsonData.length; i++) {
              const row = jsonData[i] as any[];
              if (row && row.some(cell => cell && typeof cell === 'string' && cell.toLowerCase().includes('name'))) {
                headerRowIndex = i;
                break;
              }
            }
            
            if (headerRowIndex === -1) {
              throw new Error('Could not find header row');
            }
            
            const headers = jsonData[headerRowIndex] as string[];
            const dataRows = jsonData.slice(headerRowIndex + 1);
            
            const processedData = dataRows
              .filter(row => row && (row as any[]).some(cell => cell != null && cell !== ''))
              .map(row => {
                const rowData: any = {};
                headers.forEach((header, index) => {
                  if (header) {
                    rowData[header] = (row as any[])[index];
                  }
                });
                return rowData;
              });
            
            resolve(processedData);
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

  const formatDate = (dateValue: any): string | null => {
    if (!dateValue) return null;
    
    try {
      let date: Date;
      
      if (typeof dateValue === 'number') {
        // Excel date serial number
        date = new Date((dateValue - 25569) * 86400 * 1000);
      } else if (typeof dateValue === 'string') {
        // Try to parse string date
        date = new Date(dateValue);
      } else {
        return null;
      }
      
      if (isNaN(date.getTime())) return null;
      
      // Format as YYYY-MM-DD
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error formatting date:', error);
      return null;
    }
  };

  const formatTime = (timeValue: any): string | null => {
    if (!timeValue) return null;
    
    try {
      if (typeof timeValue === 'number') {
        // Excel time serial number (fraction of a day)
        const totalMinutes = Math.round(timeValue * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      } else if (typeof timeValue === 'string') {
        // Try to parse string time
        const timeMatch = timeValue.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
          const ampm = timeMatch[4];
          
          if (ampm) {
            if (ampm.toLowerCase() === 'pm' && hours !== 12) {
              hours += 12;
            } else if (ampm.toLowerCase() === 'am' && hours === 12) {
              hours = 0;
            }
          }
          
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error formatting time:', error);
      return null;
    }
  };

  const processTimesheetData = (rawData: any[]): any[] => {
    console.log('Raw data received:', rawData);
    
    return rawData
      .filter(row => row && (row['Name'] || row['Employee Name'] || row['name']))
      .map((row: any) => {
        console.log('Processing row:', row);
        
        const employeeName = row['Name'] || row['Employee Name'] || row['name'] || 'Unknown';
        const clockInDate = formatDate(row['Clock in date'] || row['clock_in_date']);
        const clockInTime = formatTime(row['Clock in time'] || row['clock_in_time']);
        const clockOutDate = formatDate(row['Clock out date'] || row['clock_out_date']);
        const clockOutTime = formatTime(row['Clock out time'] || row['clock_out_time']);
        
        // Calculate total hours
        let totalHours = 0;
        if (clockInDate && clockInTime && clockOutDate && clockOutTime) {
          const clockInDateTime = new Date(`${clockInDate} ${clockInTime}`);
          const clockOutDateTime = new Date(`${clockOutDate} ${clockOutTime}`);
          
          // Handle next day scenario
          if (clockOutDateTime < clockInDateTime) {
            clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
          }
          
          totalHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
        }
        
        // Use actual hours if provided, otherwise use calculated
        const actualHours = parseFloat(row['Actual hours'] || row['actual_hours']) || totalHours;
        
        const processedRow = {
          employee_name: employeeName,
          clock_in_date: clockInDate,
          clock_in_time: clockInTime,
          clock_out_date: clockOutDate,
          clock_out_time: clockOutTime,
          total_hours: Math.max(0, actualHours),
          total_card_amount_flat: Math.max(0, actualHours) * 20, // Default 20 LE/hr
          break_start: formatTime(row['Break start'] || row['break_start']) || null,
          break_end: formatTime(row['Break end'] || row['break_end']) || null,
          break_length: parseFloat(row['Break length'] || row['break_length']) || null,
          break_type: row['Break type'] || row['break_type'] || null,
          payroll_id: row['Payroll ID'] || row['payroll_id'] || null,
          actual_hours: actualHours || null,
          no_show_reason: row['No show reason'] || row['no_show_reason'] || null,
          employee_note: row['Employee note'] || row['employee_note'] || null,
          manager_note: row['Manager note'] || row['manager_note'] || null,
          is_split_calculation: false
        };
        
        console.log('Processed row:', processedRow);
        return processedRow;
      })
      .filter(row => row.clock_in_date && row.clock_in_time && row.clock_out_date && row.clock_out_time);
  };

  const handleFileUpload = async () => {
    if (!file) {
      toast.error(t('selectFile') || 'Please select a file');
      return;
    }

    setUploading(true);
    try {
      const rawData = await parseFile(file);
      console.log('Parsed raw data:', rawData);
      
      const processedData = processTimesheetData(rawData);
      console.log('Processed data:', processedData);
      
      if (processedData.length === 0) {
        toast.error(t('noValidData') || 'No valid data found in file. Please check the file format.');
        return;
      }

      uploadMutation.mutate(processedData);
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error(t('errorProcessingFile') || 'Error processing file: ' + (error as Error).message);
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
          
          <div className="p-3 bg-blue-50 rounded-md text-sm">
            <p className="font-medium mb-2">Expected file format:</p>
            <ul className="text-xs space-y-1 text-gray-600">
              <li>• Name (Employee name)</li>
              <li>• Clock in date (MM/DD/YYYY or similar)</li>
              <li>• Clock in time (HH:MM AM/PM)</li>
              <li>• Clock out date (MM/DD/YYYY or similar)</li>
              <li>• Clock out time (HH:MM AM/PM)</li>
              <li>• Actual hours (optional)</li>
            </ul>
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
