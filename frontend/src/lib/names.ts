// full names: letters from any language, spaces, and the . ' - found in names like Ma. Dela Cruz-O'Brien.
// No digits, symbols or emojis. The backend has the same rule (schemas.py).
const NAME = /^\p{L}[\p{L}\p{M} .'’-]*$/u;
// characters that pass as "letters" or "marks" but show nothing: Hangul fillers and the emoji variation selectors
const INVISIBLE = /[\u115F\u1160\u3164\uFFA0\uFE00-\uFE0F]/u;

export const isValidName = (name: string) => {
  const n = name.normalize('NFC').trim();
  return NAME.test(n) && !INVISIBLE.test(n);
};

// for a name box's onChange: anything that can't be in a name (digits, symbols, emojis) is dropped as it's typed or pasted
export const cleanName = (name: string) => name.normalize('NFC').replace(/[^\p{L}\p{M} .'’-]/gu, '').replace(new RegExp(INVISIBLE.source, 'gu'), '');

export const NAME_ERROR = "Use letters, spaces and . ' - only (no numbers, symbols or emojis)";
