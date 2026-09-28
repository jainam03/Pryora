/**
 * PRYORA Client Currency and Money Helpers
 */

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', example: '₹1,50,000' },
  { code: 'USD', symbol: '$', name: 'US Dollar', example: '$2,500' },
  { code: 'EUR', symbol: '€', name: 'Euro', example: '€2.500' },
  { code: 'GBP', symbol: '£', name: 'British Pound', example: '£2,000' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', example: 'CA$2,500' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', example: 'A$2,500' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', example: 'S$2,500' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', example: 'AED 2,500' },
] as const;

export function formatMinorUnits(
  minorUnits: number = 0,
  currencyCode: string = 'INR',
  options: { showSymbol?: boolean; absolute?: boolean } = {}
): string {
  const { showSymbol = true, absolute = false } = options;
  const val = absolute ? Math.abs(minorUnits) : minorUnits;
  const major = val / 100;
  const isNegative = minorUnits < 0 && !absolute;

  let formatted = '';

  if (currencyCode === 'INR') {
    // Indian Numbering System (Lakhs and Crores)
    formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(major));

    if (showSymbol) {
      formatted = `₹${formatted}`;
    }
  } else {
    // International standard formatting
    formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(major));

    if (showSymbol) {
      const match = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
      const sym = match ? match.symbol : currencyCode;
      formatted = `${sym}${formatted}`;
    }
  }

  return isNegative ? `-${formatted}` : formatted;
}

export function formatShortMinorUnits(minorUnits: number = 0, currencyCode: string = 'INR'): string {
  const major = minorUnits / 100;
  const absMajor = Math.abs(major);
  const symbol = currencyCode === 'INR' ? '₹' : (SUPPORTED_CURRENCIES.find(c => c.code === currencyCode)?.symbol || '');

  if (currencyCode === 'INR') {
    if (absMajor >= 10000000) {
      return `${symbol}${(major / 10000000).toFixed(2)} Cr`;
    }
    if (absMajor >= 100000) {
      return `${symbol}${(major / 100000).toFixed(2)} L`;
    }
    if (absMajor >= 1000) {
      return `${symbol}${(major / 1000).toFixed(1)}k`;
    }
  } else {
    if (absMajor >= 1000000) {
      return `${symbol}${(major / 1000000).toFixed(1)}M`;
    }
    if (absMajor >= 1000) {
      return `${symbol}${(major / 1000).toFixed(1)}k`;
    }
  }

  return formatMinorUnits(minorUnits, currencyCode);
}
