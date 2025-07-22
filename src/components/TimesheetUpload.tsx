
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, X, Eye, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { parseFile } from '@/utils/fileParser';
import { supabase } from '@/integrations/supabase/client';
import { useTimesheetUpload } from '@/hooks/useTimesheetUpload';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface TimesheetUploadProps {
  onClose: () => void;
  onUploadComplete: () => void;
}

interface PreviewRow {
  data: any;
  errors: string[];
  warnings: string[];
}

const TimesheetUpload: React.FC<TimesheetUploadProps> = ({ onClose, onUploadComplete }) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  const uploadMutation = useTimesheetUpload(onUploadComplete, onClose);

  const validateRow = (row: any): { errors: string[], warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!row.employee_name || row.employee_name.trim() === '') {
      errors.push('Employee name is required');
    }
    if (!row.clock_in_date) {
      errors.push('Clock in date is required');
    }
    if (!row.clock_in_time) {
      errors.push('Clock in time is required');
    }
    if (!row.clock_out_date) {
      errors.push('Clock out date is required');
    }
    if (!row.clock_out_time) {
      errors.push('Clock out time is required');
    }
    if (row.total_hours && (row.total_hours < 0 || row.total_hours > 24)) {
      warnings.push('Total hours seems unusual (< 0 or > 24)');
    }
    if (!row.payroll_id) {
      warnings.push('Payroll ID is missing - will be auto-generated');
    }

    return { errors, warnings };
  };

  const handleFilePreview = async () => {
    if (!file) {
      toast.error(t('selectFile') || 'Please select a file');
      return;
    }

    setUploading(true);
    try {
      const rawData = await parseFile(file);
      console.log('Parsed raw data:', rawData);
      
      // Use the new edge function for processing and validation
      const { data: result, error } = await supabase.functions.invoke('process-timesheet', {
        body: {
          data: rawData,
          validateOnly: true // Only validate for preview
        }
      });

      if (error) {
        console.error('Error validating timesheet data:', error);
        toast.error('Error validating timesheet data: ' + error.message);
        return;
      }

      if (result && result.success) {
        console.log('Validation result:', result);
        
        if (result.validEntries === 0) {
          toast.error(t('noValidData') || 'No valid data found in file. Please check the file format.');
          return;
        }

        // Create preview data with validation
        const preview: PreviewRow[] = result.preview.map((row: any, index: number) => {
          const { errors, warnings } = validateRow(row);
          return { data: row, errors, warnings };
        });

        // Show validation errors if any
        if (result.errors && result.errors.length > 0) {
          console.warn('Validation errors:', result.errors);
        }

        setPreviewData(preview);
        setProcessedData(result.preview);
        setShowPreview(true);
        
        if (result.errors.length > 0) {
          toast.warning(`Processed ${result.validEntries} valid entries. ${result.errors.length} rows had issues.`);
        } else {
          toast.success(`Successfully validated ${result.validEntries} entries.`);
        }
      } else {
        toast.error(result?.error || 'Unknown error occurred during validation');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error(t('errorProcessingFile') || 'Error processing file: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmUpload = async () => {
    const hasErrors = previewData.some(row => row.errors.length > 0);
    if (hasErrors) {
      toast.error('Please fix the errors before uploading');
      return;
    }

    try {
      setUploading(true);
      
      // Parse file again and process for real this time
      const rawData = await parseFile(file!);
      
      const { data: result, error } = await supabase.functions.invoke('process-timesheet', {
        body: {
          data: rawData,
          validateOnly: false, // Actually process and insert
          overwriteExisting: overwriteExisting // Pass the overwrite setting
        }
      });

      if (error) {
        console.error('Error uploading timesheet data:', error);
        toast.error('Error uploading timesheet data: ' + error.message);
        return;
      }

      if (result && result.success) {
        toast.success(`Successfully uploaded ${result.processed} timesheet entries!`);
        onUploadComplete();
        onClose();
      } else {
        toast.error(result?.error || 'Unknown error occurred during upload');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleBackToFileSelection = () => {
    setShowPreview(false);
    setPreviewData([]);
    setProcessedData([]);
  };

  if (showPreview) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {t('previewData') || 'Preview Data'}
              </span>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <div className="mb-4 p-4 bg-blue-50 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium">
                  {processedData.length} records ready for import
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Showing first 10 rows. Please review for accuracy before confirming the upload.
              </p>
            </div>

            <div className="border rounded-md overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={index} className={row.errors.length > 0 ? 'bg-red-50' : row.warnings.length > 0 ? 'bg-yellow-50' : ''}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{row.data.employee_name}</TableCell>
                      <TableCell>{row.data.clock_in_date}</TableCell>
                      <TableCell>{row.data.clock_in_time}</TableCell>
                      <TableCell>{row.data.clock_out_time}</TableCell>
                      <TableCell>{row.data.total_hours?.toFixed(2) || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {row.errors.map((error, i) => (
                            <div key={i} className="flex items-center gap-1 text-red-600 text-xs">
                              <AlertTriangle className="h-3 w-3" />
                              {error}
                            </div>
                          ))}
                          {row.warnings.map((warning, i) => (
                            <div key={i} className="flex items-center gap-1 text-yellow-600 text-xs">
                              <AlertTriangle className="h-3 w-3" />
                              {warning}
                            </div>
                          ))}
                          {row.errors.length === 0 && row.warnings.length === 0 && (
                            <div className="flex items-center gap-1 text-green-600 text-xs">
                              <CheckCircle className="h-3 w-3" />
                              Valid
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleBackToFileSelection}>
              Back to File Selection
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleConfirmUpload}
                disabled={uploadMutation.isPending || previewData.some(row => row.errors.length > 0)}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploadMutation.isPending 
                  ? (t('uploading') || 'Uploading...') 
                  : `Confirm Upload (${processedData.length} records)`
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="overwrite" 
              checked={overwriteExisting}
              onCheckedChange={(checked) => setOverwriteExisting(checked as boolean)}
            />
            <Label htmlFor="overwrite" className="text-sm">
              Overwrite existing timecards with same date (otherwise skip duplicates)
            </Label>
          </div>
          
          <div className="p-3 bg-blue-50 rounded-md text-sm">
            <p className="font-medium mb-2">Expected file format:</p>
            <ul className="text-xs space-y-1 text-gray-600">
              <li>• Name (Employee name)</li>
              <li>• Clock in date (MM/DD/YYYY or similar)</li>
              <li>• Clock in time (HH:MM AM/PM)</li>
              <li>• Clock out date (MM/DD/YYYY or similar)</li>
              <li>• Clock out time (HH:MM AM/PM)</li>
              <li>• Payroll ID (optional - auto-generated if missing)</li>
              <li>• Actual hours (optional)</li>
            </ul>
            <p className="text-xs text-green-600 mt-2 font-medium">
              ✨ New employees will be automatically created!
            </p>
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
              onClick={handleFilePreview}
              disabled={!file || uploading}
              className="flex-1 flex items-center space-x-2"
            >
              <Eye className="h-4 w-4" />
              <span>
                {uploading 
                  ? (t('processing') || 'Processing...') 
                  : (t('preview') || 'Preview Data')
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
