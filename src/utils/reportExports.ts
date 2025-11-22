import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

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

/**
 * Format time string from 24-hour format to AM/PM format
 */
const formatTimeAMPM = (timeStr: string | null | undefined): string => {
  if (!timeStr) return '';
  
  // Remove milliseconds if present
  const cleanTime = timeStr.split('.')[0];
  const [hours, minutes] = cleanTime.split(':');
  const hour = parseInt(hours, 10);
  const minute = parseInt(minutes || '0', 10);
  
  if (isNaN(hour) || isNaN(minute)) return timeStr;
  
  if (hour === 0) {
    return `12:${String(minute).padStart(2, '0')} AM`;
  } else if (hour < 12) {
    return `${hour}:${String(minute).padStart(2, '0')} AM`;
  } else if (hour === 12) {
    return `12:${String(minute).padStart(2, '0')} PM`;
  } else {
    return `${hour - 12}:${String(minute).padStart(2, '0')} PM`;
  }
};

/**
 * Round money value - no amounts less than 1 EGP
 */
const roundMoney = (amount: number): number => {
  return Math.round(amount);
};

/**
 * Enhanced export for Attendance Report with payroll-style format
 * Groups entries by employee with totals, includes morning/night hours and wages,
 * and points system data if enabled
 */
export const exportAttendanceReportToExcel = async (
  attendanceData: any[],
  filename: string,
  dateRange: { from: Date; to: Date },
  organizationId: string | null,
  isPointsSystemActive: boolean = false,
  pointValue: number = 5,
  maxWorkingHours: number = 6,
  organizationName: string = ''
) => {
  if (attendanceData.length === 0) {
    throw new Error('No data to export');
  }

  // Group entries by employee
  const employeeGroups = new Map<string, any[]>();
  
  attendanceData.forEach(entry => {
    const employeeName = entry.display_name || entry.employee_name || 'Unknown';
    if (!employeeGroups.has(employeeName)) {
      employeeGroups.set(employeeName, []);
    }
    employeeGroups.get(employeeName)!.push(entry);
  });

  // Fetch points data per entry if points system is active
  const entryPointsMap = new Map<string, { points: number; pointsAmount: number; occurrenceDate: string }>();
  
  if (isPointsSystemActive && organizationId) {
    // Get all timesheet entry IDs
    const timesheetEntryIds = attendanceData
      .map(e => e.id)
      .filter(Boolean);

    if (timesheetEntryIds.length > 0) {
      try {
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        
        // Fetch points log entries linked to timesheet entries or by date
        const { data: pointsLog } = await supabase
          .from('employee_points_log')
          .select('points, occurrence_date, timesheet_entry_id, employee_id')
          .eq('organization_id', organizationId)
          .gte('occurrence_date', fromDate)
          .lte('occurrence_date', toDate);

        if (pointsLog && pointsLog.length > 0) {
          // Map points by timesheet_entry_id first, then by date+employee_id
          pointsLog.forEach((logEntry: any) => {
            if (logEntry.timesheet_entry_id && timesheetEntryIds.includes(logEntry.timesheet_entry_id)) {
              // Points linked to specific timesheet entry
              entryPointsMap.set(logEntry.timesheet_entry_id, {
                points: logEntry.points || 0,
                pointsAmount: (logEntry.points || 0) * pointValue,
                occurrenceDate: logEntry.occurrence_date
              });
            } else {
              // Points not linked to entry - match by date and employee
              const matchingEntry = attendanceData.find(e => 
                e.employee_id === logEntry.employee_id &&
                e.clock_in_date === logEntry.occurrence_date
              );
              if (matchingEntry && !entryPointsMap.has(matchingEntry.id)) {
                entryPointsMap.set(matchingEntry.id, {
                  points: logEntry.points || 0,
                  pointsAmount: (logEntry.points || 0) * pointValue,
                  occurrenceDate: logEntry.occurrence_date
                });
              }
            }
          });
        }
      } catch (error) {
        console.error('Error fetching points data:', error);
      }
    }
  }

  // Also create employee totals map for totals row
  const employeePointsMap = new Map<string, { totalPoints: number; pointsAmount: number }>();
  if (isPointsSystemActive && organizationId) {
    const employeeIds = Array.from(new Set(
      attendanceData
        .map(e => e.employee_id)
        .filter(Boolean)
    ));

    for (const empId of employeeIds) {
      try {
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        
        const { data: pointsLog } = await supabase
          .from('employee_points_log')
          .select('points')
          .eq('employee_id', empId)
          .eq('organization_id', organizationId)
          .gte('occurrence_date', fromDate)
          .lte('occurrence_date', toDate);

        if (pointsLog && pointsLog.length > 0) {
          const totalPoints = pointsLog.reduce((sum, entry) => sum + (entry.points || 0), 0);
          const pointsAmount = totalPoints * pointValue;
          
          const empEntry = attendanceData.find(e => e.employee_id === empId);
          if (empEntry) {
            const empName = empEntry.display_name || empEntry.employee_name;
            employeePointsMap.set(empName, { totalPoints, pointsAmount });
          }
        }
      } catch (error) {
        console.error(`Error fetching points for employee ${empId}:`, error);
      }
    }
  }

  // Build Excel data in payroll format
  const excelRows: any[] = [];
  
  // Format payroll period date range
  const formatPayrollPeriod = () => {
    const fromStr = format(dateRange.from, 'MM/dd/yyyy');
    const toStr = format(dateRange.to, 'MM/dd/yyyy');
    return `${fromStr} To ${toStr}`;
  };

  // Define headers first (before using them)
  const headers: any = {
    'Name': 'Name',
    'Clock in date': 'Clock in date',
    'Clock in time': 'Clock in time',
    'Clock out date': 'Clock out date',
    'Clock out time': 'Clock out time',
    'Morning wage rate': 'Morning wage rate',
    'Night wage rate': 'Night wage rate',
    'Total paid hours': 'Total paid hours',
    'Morning hours': 'Morning hours',
    'Night hours': 'Night hours',
    'Morning wages': 'Morning wages',
    'Night wages': 'Night wages',
    'Estimated wages': 'Estimated wages'
  };

  if (isPointsSystemActive) {
    headers['Total earned points'] = 'Total earned points';
    headers['Point value'] = 'Point value';
    headers['Cash tips'] = 'Cash tips';
  }

  // Calculate number of columns for merging
  const getColumnCount = () => {
    let count = 13; // Base columns (was 12, now 13 with split wage rates)
    if (isPointsSystemActive) {
      count += 3; // Points columns
    }
    return count;
  };

  // Add organization name row - start directly with organization name (no column header)
  // Use a special key that won't appear as a column header
  const orgRow: any = {};
  orgRow['__ORG_NAME__'] = organizationName || 'Organization';
  excelRows.push(orgRow);

  // Add payroll period row
  const periodRow: any = {};
  periodRow['__PERIOD_LABEL__'] = 'Payroll Period';
  periodRow['__PERIOD_VALUE__'] = formatPayrollPeriod();
  excelRows.push(periodRow);

  // Empty row for spacing
  excelRows.push({});

  // Header row
  excelRows.push(headers);

  // Format date in "MMM dd, yyyy" format
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return format(date, 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  // Process each employee group
  const sortedEmployees = Array.from(employeeGroups.keys()).sort();
  
  for (const employeeName of sortedEmployees) {
    const entries = employeeGroups.get(employeeName)!;
    
    // Sort entries by date
    entries.sort((a, b) => {
      const dateA = a.clock_in_date || '';
      const dateB = b.clock_in_date || '';
      return dateA.localeCompare(dateB);
    });

    // Add empty row before employee section (but not before first employee)
    if (excelRows.length > 1) { // Only add if we already have header and at least one row
      excelRows.push({});
    }

    // Process each entry for this employee
    let employeeTotalHours = 0;
    let employeeTotalMorningHours = 0;
    let employeeTotalNightHours = 0;
    let employeeTotalMorningWages = 0;
    let employeeTotalNightWages = 0;
    let employeeTotalWages = 0;
    let employeeTotalPoints = 0;
    let employeeTotalPointsAmount = 0;

    entries.forEach(entry => {
      const morningHours = entry.calculated_morning_hours || entry.morning_hours || 0;
      const nightHours = entry.calculated_night_hours || entry.night_hours || 0;
      const totalHours = entry.total_hours || morningHours + nightHours;
      
      // Get wage rates (from entry or default)
      const morningRate = entry.morning_wage_rate || 17;
      const nightRate = entry.night_wage_rate || 20;
      const wageRate = morningRate; // Default wage rate for display
      
      const morningWages = roundMoney(morningHours * morningRate);
      const nightWages = roundMoney(nightHours * nightRate);
      const totalWages = roundMoney(entry.calculated_amount || entry.total_card_amount_flat || morningWages + nightWages);

      employeeTotalHours += totalHours;
      employeeTotalMorningHours += morningHours;
      employeeTotalNightHours += nightHours;
      employeeTotalMorningWages += morningWages;
      employeeTotalNightWages += nightWages;
      employeeTotalWages += totalWages;

      // Get points for this entry
      const entryPoints = entryPointsMap.get(entry.id);
      const entryPointsValue = entryPoints?.points || 0;
      const entryPointsAmount = entryPoints?.pointsAmount || 0;

      // Check if shift exceeds max working hours (for highlighting)
      const exceedsMaxHours = totalHours > maxWorkingHours;

      const row: any = {
        'Name': employeeName,
        'Clock in date': formatDateDisplay(entry.clock_in_date || ''),
        'Clock in time': formatTimeAMPM(entry.clock_in_time),
        'Clock out date': formatDateDisplay(entry.clock_out_date || entry.clock_in_date || ''),
        'Clock out time': entry.clock_out_time ? formatTimeAMPM(entry.clock_out_time) : 'Active',
        'Morning wage rate': `$${morningRate.toFixed(2)}`,
        'Night wage rate': `$${nightRate.toFixed(2)}`,
        'Total paid hours': totalHours.toFixed(2),
        'Morning hours': morningHours.toFixed(2),
        'Night hours': nightHours.toFixed(2),
        'Morning wages': `$${morningWages.toFixed(2)}`,
        'Night wages': `$${nightWages.toFixed(2)}`,
        'Estimated wages': `$${totalWages.toFixed(2)}`
      };

      if (isPointsSystemActive) {
        // Show points per entry if available
        row['Total earned points'] = entryPointsValue !== 0 ? entryPointsValue : '';
        row['Point value'] = entryPointsValue !== 0 ? `$${pointValue.toFixed(2)}` : '';
        row['Cash tips'] = entryPointsAmount !== 0 ? `$${entryPointsAmount.toFixed(2)}` : '';
        
        // Track totals for employee
        employeeTotalPoints += entryPointsValue;
        employeeTotalPointsAmount += entryPointsAmount;
      }

      // Store row index and highlight flag for styling
      (row as any)._exceedsMaxHours = exceedsMaxHours;

      excelRows.push(row);
    });

    // Employee totals row
    const pointsData = employeePointsMap.get(employeeName);
    const employeePoints = pointsData?.totalPoints || 0;
    const employeePointsAmount = pointsData?.pointsAmount || 0;

    const totalsRow: any = {
      'Name': `Totals for ${employeeName}`,
      'Clock in date': '',
      'Clock in time': '',
      'Clock out date': '',
      'Clock out time': '',
      'Morning wage rate': '',
      'Night wage rate': '',
      'Total paid hours': employeeTotalHours.toFixed(2),
      'Morning hours': employeeTotalMorningHours.toFixed(2),
      'Night hours': employeeTotalNightHours.toFixed(2),
      'Morning wages': `$${employeeTotalMorningWages.toFixed(2)}`,
      'Night wages': `$${employeeTotalNightWages.toFixed(2)}`,
      'Estimated wages': `$${employeeTotalWages.toFixed(2)}`
    };

    if (isPointsSystemActive) {
      // Show points data in totals row (positive or negative)
      totalsRow['Total earned points'] = employeePoints !== 0 ? employeePoints : '';
      totalsRow['Point value'] = employeePoints !== 0 ? `$${pointValue.toFixed(2)}` : '';
      // Cash tips shows the monetary value (can be positive or negative)
      totalsRow['Cash tips'] = employeePointsAmount !== 0 ? `$${employeePointsAmount.toFixed(2)}` : '';
    }

    excelRows.push(totalsRow);
  }

  // Track which rows need highlighting (by index in excelRows array)
  const highlightRowIndices = new Set<number>();
  excelRows.forEach((row: any, idx: number) => {
    if (row._exceedsMaxHours) {
      highlightRowIndices.add(idx);
    }
  });

  // Convert to array of arrays for full control over rows and headers
  const headerKeys = Object.keys(headers);
  const numCols = headerKeys.length;
  const dataArrays: any[][] = [];
  
  excelRows.forEach((row: any, idx: number) => {
    if (row.__ORG_NAME__) {
      // Organization name row - fill entire row with org name in first cell, rest empty
      const orgRowArray = [row.__ORG_NAME__, ...Array(numCols - 1).fill('')];
      dataArrays.push(orgRowArray);
    } else if (row.__PERIOD_LABEL__) {
      // Period row - label in first cell, value in second, rest empty
      const periodRowArray = [row.__PERIOD_LABEL__, row.__PERIOD_VALUE__, ...Array(numCols - 2).fill('')];
      dataArrays.push(periodRowArray);
    } else if (Object.keys(row).length === 0) {
      // Empty row - fill with empty strings
      dataArrays.push(Array(numCols).fill(''));
    } else {
      // Data row - convert object to array matching header order
      const rowArray = headerKeys.map(key => {
        const value = row[key];
        // Ensure values are primitive types (string, number, boolean, null)
        if (value === undefined || value === null) return '';
        if (typeof value === 'object') return String(value);
        return value;
      });
      dataArrays.push(rowArray);
    }
  });
  
  // Use xlsx-js-style library to create base worksheet
  const ws = XLSXStyle.utils.aoa_to_sheet(dataArrays);
  
  // Set column widths
  const cols = [
    { wch: 20 }, // Name
    { wch: 15 }, // Clock in date
    { wch: 15 }, // Clock in time
    { wch: 15 }, // Clock out date
    { wch: 15 }, // Clock out time
    { wch: 16 }, // Morning wage rate
    { wch: 16 }, // Night wage rate
    { wch: 15 }, // Total paid hours
    { wch: 15 }, // Morning hours
    { wch: 15 }, // Night hours
    { wch: 15 }, // Morning wages
    { wch: 15 }, // Night wages
    { wch: 18 }, // Estimated wages
  ];

  if (isPointsSystemActive) {
    cols.push({ wch: 18 }); // Total earned points
    cols.push({ wch: 12 }); // Point value
    cols.push({ wch: 15 }); // Cash tips
  }

  ws['!cols'] = cols;

  // Get the range of the worksheet
  const range = XLSXStyle.utils.decode_range(ws['!ref'] || 'A1');
  
  // Add cell merges for org name and period rows
  if (!ws['!merges']) ws['!merges'] = [];
  
  // Merge org name row (row 0) across all columns
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } });
  
  // Merge period value (row 1, starting from column 1) across remaining columns
  ws['!merges'].push({ s: { r: 1, c: 1 }, e: { r: 1, c: numCols - 1 } });
  
  // Apply cell styles using xlsx-js-style
  // Note: xlsx-js-style allows styling, standard xlsx does not
  
  // Style each cell
  for (let rowIdx = 0; rowIdx <= range.e.r; rowIdx++) {
    for (let colIdx = 0; colIdx <= range.e.c; colIdx++) {
      const cellRef = XLSXStyle.utils.encode_cell({ r: rowIdx, c: colIdx });
      const cell = ws[cellRef];
      
      if (!cell) continue;
      
      // Initialize cell style
      if (!cell.s) cell.s = {};
      
      // Row 0: Organization name (bold, large font)
      if (rowIdx === 0) {
        cell.s = { font: { bold: true, sz: 14 }, alignment: { vertical: 'center' } };
      }
      // Row 1: Payroll period (bold label)
      else if (rowIdx === 1) {
        if (colIdx === 0) {
          cell.s = { font: { bold: true, sz: 11 }, alignment: { vertical: 'center' } };
        } else {
          cell.s = { font: { sz: 11 }, alignment: { vertical: 'center' } };
        }
      }
      // Row 3: Header row (bold, gray background)
      else if (rowIdx === 3) {
        cell.s = {
          font: { bold: true, sz: 11 },
          fill: { fgColor: { rgb: 'E0E0E0' } },
          alignment: { vertical: 'center', horizontal: 'center' }
        };
      }
      // Row 4+: Data rows
      else if (rowIdx >= 4) {
        // Get corresponding row in excelRows
        const excelRowIdx = rowIdx - 0; // Direct mapping since we use array of arrays
        const excelRow = excelRows[excelRowIdx];
        
        if (excelRow && excelRow['Name']?.startsWith('Totals for')) {
          // Totals row: bold, light green background
          cell.s = {
            font: { bold: true, sz: 11 },
            fill: { fgColor: { rgb: 'D9EAD3' } }, // Light green
            alignment: { vertical: 'center' }
          };
        } else if (highlightRowIndices.has(excelRowIdx)) {
          // Long shift row: light yellow background
          cell.s = {
            font: { sz: 11 },
            fill: { fgColor: { rgb: 'FFFF99' } }, // Light yellow
            alignment: { vertical: 'center' }
          };
        } else {
          // Regular data row
          cell.s = {
            font: { sz: 11 },
            alignment: { vertical: 'center' }
          };
        }
      }
    }
  }

  // Create workbook and write file using xlsx-js-style for styling support
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Attendance Report');
  
  // Write file with xlsx-js-style to preserve styling
  XLSXStyle.writeFile(wb, filename);
};



