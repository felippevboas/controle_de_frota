import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || isNaN(Number(value))) return '0';
  return new Intl.NumberFormat('pt-BR').format(Number(value));
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return '-';
  
  try {
    let d: Date;
    
    if (date instanceof Date) {
      d = date;
    } else {
      const s = String(date).trim();
      
      // If it's a simple date string YYYY-MM-DD, parse it as local midnight to avoid shifts
      if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = s.split('-').map(Number);
        d = new Date(year, month - 1, day);
      } 
      // Handle DD/MM/YYYY
      else if (s.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [day, month, year] = s.split('/').map(Number);
        d = new Date(year, month - 1, day);
      }
      // If it's a full timestamp but we only want the date part for display (common for "Entrada")
      // we extract the date part to avoid timezone shifts that might move it to another day
      else if (s.match(/^\d{4}-\d{2}-\d{2}[T ]/)) {
        const datePart = s.split(/[T ]/)[0];
        const [year, month, day] = datePart.split('-').map(Number);
        d = new Date(year, month - 1, day);
      }
      else {
        d = new Date(s);
      }
    }

    if (isNaN(d.getTime())) return '-';
    
    // Use Intl.DateTimeFormat for consistent Brazilian formatting
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d);
  } catch (e) {
    return '-';
  }
}

export function parseExcelDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().replace('T', ' ').split('.')[0];
  
  // If it's a number, it's likely an Excel serial date
  if (typeof val === 'number' && val > 10000) {
    // Excel date serial number to JS Date
    // 25569 is the number of days between 1900-01-01 and 1970-01-01
    // We use Math.round to avoid floating point issues
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString().replace('T', ' ').split('.')[0];
  }
  
  const s = String(val).trim();
  // Handle DD/MM/YYYY or DD-MM-YYYY
  if (s.includes('/') || s.match(/^\d{2}-\d{2}-\d{4}/)) {
    const parts = s.split(' ');
    const datePart = parts[0];
    const timePart = parts[1] || '';
    
    const dateSeparator = datePart.includes('/') ? '/' : '-';
    const dateParts = datePart.split(dateSeparator);
    
    if (dateParts.length === 3) {
      // Check if first part is year (YYYY/MM/DD)
      if (dateParts[0].length === 4) {
        const year = dateParts[0];
        const month = dateParts[1].padStart(2, '0');
        const day = dateParts[2].padStart(2, '0');
        return `${year}-${month}-${day}${timePart ? ' ' + timePart : ''}`;
      } else {
        const day = dateParts[0].padStart(2, '0');
        const month = dateParts[1].padStart(2, '0');
        const year = dateParts[2];
        // Ensure year is 4 digits
        const fullYear = year.length === 2 ? `20${year}` : year;
        return `${fullYear}-${month}-${day}${timePart ? ' ' + timePart : ''}`;
      }
    }
  }
  
  // Handle YYYY-MM-DD
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
    return s;
  }
  
  return s;
}

export function getLocalISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getFirstDayOfMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function calculateDaysUntil(date: string | Date | null | undefined) {
  if (!date) return null;
  
  try {
    let d: Date;
    if (date instanceof Date) {
      d = new Date(date);
    } else {
      const s = String(date).trim();
      if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = s.split('-').map(Number);
        d = new Date(year, month - 1, day);
      } else {
        d = new Date(s);
      }
    }

    if (isNaN(d.getTime())) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    
    const diffTime = d.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (e) {
    return null;
  }
}
