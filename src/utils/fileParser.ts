
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export const parseFile = async (file: File): Promise<any[]> => {
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
