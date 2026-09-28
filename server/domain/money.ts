/**
 * PRYORA Financial Domain - Exact Money Representation
 * 
 * Money is always represented in integer minor units (cents, paise, etc.)
 * to prevent IEEE 754 floating-point inaccuracies.
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
  symbolPosition: 'prefix' | 'suffix';
  thousandsSeparator: string;
  decimalSeparator: string;
}

export const CURRENCIES: Record<string, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    decimals: 2,
    symbolPosition: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    decimals: 2,
    symbolPosition: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    decimals: 2,
    symbolPosition: 'prefix',
    thousandsSeparator: '.',
    decimalSeparator: ',',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    decimals: 2,
    symbolPosition: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  CAD: {
    code: 'CAD',
    symbol: 'CA$',
    name: 'Canadian Dollar',
    decimals: 2,
    symbolPosition: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    decimals: 2,
    symbolPosition: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    decimals: 0,
    symbolPosition: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    name: 'Singapore Dollar',
    decimals: 2,
    symbolPosition: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  AED: {
    code: 'AED',
    symbol: 'AED ',
    name: 'UAE Dirham',
    decimals: 2,
    symbolPosition: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
};

/**
 * Converts major units (e.g. 450.50) or user input string to integer minor units (45050).
 */
export function toMinorUnits(amount: number | string, currencyCode: string = 'INR'): number {
  const currency = CURRENCIES[currencyCode] || CURRENCIES.INR;
  const multiplier = Math.pow(10, currency.decimals);

  if (typeof amount === 'string') {
    // Strip out currency symbols and clean commas
    const cleaned = amount.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * multiplier);
  }

  if (isNaN(amount)) return 0;
  return Math.round(amount * multiplier);
}

/**
 * Converts minor units (45050) to decimal major units (450.50).
 */
export function toMajorUnits(minorUnits: number, currencyCode: string = 'INR'): number {
  const currency = CURRENCIES[currencyCode] || CURRENCIES.INR;
  const divisor = Math.pow(10, currency.decimals);
  return minorUnits / divisor;
}

/**
 * Formats minor units into an attractive display string.
 * Supports Indian numbering system (e.g. ₹1,50,000.00) for INR and standard international for others.
 */
export function formatMoney(
  minorUnits: number,
  currencyCode: string = 'INR',
  options: { showSign?: boolean; showSymbol?: boolean } = {}
): string {
  const { showSign = false, showSymbol = true } = options;
  const currency = CURRENCIES[currencyCode] || CURRENCIES.INR;
  const isNegative = minorUnits < 0;
  const absUnits = Math.abs(minorUnits);
  const majorValue = toMajorUnits(absUnits, currencyCode);

  let formattedNumber: string;

  if (currencyCode === 'INR') {
    // Indian numbering format (Lakhs and Crores)
    const parts = majorValue.toFixed(currency.decimals).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];

    let lastThree = integerPart.slice(-3);
    const otherNumbers = integerPart.slice(0, -3);
    if (otherNumbers !== '') {
      lastThree = ',' + lastThree;
    }
    const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
    formattedNumber = currency.decimals > 0 ? `${formattedInteger}.${decimalPart}` : formattedInteger;
  } else {
    // Standard international formatting
    const parts = majorValue.toFixed(currency.decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, currency.thousandsSeparator);
    formattedNumber = currency.decimals > 0 ? parts.join(currency.decimalSeparator) : parts[0];
  }

  const symbol = showSymbol ? currency.symbol : '';
  const sign = isNegative ? '-' : showSign ? '+' : '';

  if (currency.symbolPosition === 'suffix') {
    return `${sign}${formattedNumber} ${symbol}`.trim();
  }
  return `${sign}${symbol}${formattedNumber}`;
}
