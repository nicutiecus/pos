/**
 * Safely parses backend date strings into human-readable formats.
 * Fixes the common Safari "Invalid Date" bug caused by spaces instead of 'T'.
 */
export const formatBackendDate = (
  dateString: string | null | undefined, 
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!dateString) return 'N/A';

  try {
    // 1. Fix the Safari/iOS bug by replacing the space between date and time with a 'T'
    let safeString = dateString;
    if (typeof dateString === 'string' && dateString.includes(' ') && !dateString.includes('T')) {
      safeString = dateString.replace(' ', 'T');
    }

    // 2. Parse the date
    const dateObj = new Date(safeString);

    // 3. Check if it is STILL invalid (isNaN checks if the date time value is a valid number)
    if (isNaN(dateObj.getTime())) {
      return dateString; // Fallback: just return the raw backend string if we can't parse it
    }

    // 4. Return formatted string (Default: Oct 27, 2023, 02:30 PM)
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };

    return dateObj.toLocaleString(undefined, options || defaultOptions);

  } catch (error) {
    console.error("Date formatting error:", error);
    return dateString; // Fallback
  }
};