// Philippine mobile numbers, typed as 09171234567 or 639171234567 (spaces and + are dropped) and saved as 09171234567

// for the input box: digits only, and no longer than a full number
export function cleanMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.slice(0, digits.startsWith('63') ? 12 : 11);
}

export function normalizeMobile(mobile: string) {
  const digits = mobile.replace(/\D/g, '');
  return digits.startsWith('63') ? `0${digits.slice(2)}` : digits;
}

export const isValidMobile = (mobile: string) => /^09\d{9}$/.test(normalizeMobile(mobile));

export const MOBILE_ERROR = 'Use a number like 09171234567 or 639171234567';
