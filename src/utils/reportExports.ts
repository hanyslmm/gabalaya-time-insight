import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { format } from 'date-fns';

// PDF generation using canvas (lightweight approach)
export const exportToPDF = (data: any[], columns: string[], filename: string, title: string) => {
  // For now, we'll use a simple HTML-to-PDF approach via window.print()
  // A more robust solution would require jspdf library
  const html = generatePDFHTML(data, columns, title);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
};

const generatePDFHTML = (data: any[], columns: string[], title: string): string => {
  const tableRows = data.map(row =>
    `<tr>${columns.map(col => `<td>${row[col] || ''}</td>`).join('')}</tr>`
  ).join('');

  const tableHeaders = columns.map(col => `<th>${col}</th>`).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @media print {
          @page { margin: 1cm; }
        }
        body {
          font-family: Arial, sans-serif;
          direction: rtl;
          text-align: right;
        }
        h1 { text-align: center; margin-bottom: 20px; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: right;
        }
        th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p>Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}</p>
      <table>
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
    </html>
  `;
};

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (data: any[], filename: string, sheetName: string) => {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const ws = XLSX.utils.json_to_sheet(data);
  const cols = Object.keys(data[0]).map(key => ({
    wch: Math.max(key.length, 12)
  }));
  ws['!cols'] = cols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  XLSX.writeFile(wb, filename);
};



