import { format, startOfWeek, endOfWeek, getISOWeek, parseISO, isValid } from 'date-fns';

export function getWeekInfo(date: Date = new Date()) {
  // Use ISO week to be consistent with common European standards (Monday start)
  const safeDate = isValid(date) ? date : new Date();
  const weekNumber = getISOWeek(safeDate);
  const start = startOfWeek(safeDate, { weekStartsOn: 1 });
  const end = endOfWeek(safeDate, { weekStartsOn: 1 });
  
  return {
    weekNumber,
    startDate: start.toISOString(),
    endDate: end.toISOString()
  };
}

export function formatBulletinDateRange(startStr: string, endStr: string) {
  try {
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    
    if (!isValid(start) || !isValid(end)) {
      return 'Invalid Date Range';
    }
    
    // Format: 6th - 12th Apr 2026
    return `${format(start, 'do')} - ${format(end, 'do MMM yyyy')}`;
  } catch (e) {
    return 'Invalid Date Range';
  }
}

export function formatShortDateRange(startStr: string, endStr: string) {
  try {
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    
    if (!isValid(start) || !isValid(end)) {
      return 'N/A';
    }
    
    // Format: 6-12 Apr 2026
    return `${format(start, 'd')}-${format(end, 'd MMM yyyy')}`;
  } catch (e) {
    return 'N/A';
  }
}

export async function compressImage(dataUrl: string, maxWidth = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
