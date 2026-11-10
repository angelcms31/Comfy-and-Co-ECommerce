// Philippine mobile numbers: exactly 11 digits, 09171234567. A pasted +63 917 123 4567 is turned into 0917...

export const MOBILE_LENGTH = 11;

// for the input box: digits only, never more than 11
export function cleanMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  const local = digits.length > MOBILE_LENGTH && digits.startsWith('63') ? `0${digits.slice(2)}` : digits;
  return local.slice(0, MOBILE_LENGTH);
}

export function normalizeMobile(mobile: string) {
  const digits = mobile.replace(/\D/g, '');
  return digits.startsWith('63') ? `0${digits.slice(2)}` : digits;
}

export const isValidMobile = (mobile: string) => /^09\d{9}$/.test(normalizeMobile(mobile));

export const MOBILE_ERROR = 'Enter an 11-digit mobile number like 09171234567';
export const MOBILE_REQUIRED = 'Please enter your mobile number';
