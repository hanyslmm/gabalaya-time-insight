
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { parseFile } from '@/utils/fileParser';
import { processTimesheetData } from '@/utils/timesheetDataProcessor';
import { useTimesheetUpload } from '@/hooks/useTimesheetUpload';

interface TimesheetUploadProps {
  onClose: () => void;
  onUploadComplete: () => void;
}

const TimesheetUpload: React.FC<TimesheetUploadProps> = ({ onClose, onUploadComplete }) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadMutation = useTimesheetUpload(onUploadComplete, onClose);

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
