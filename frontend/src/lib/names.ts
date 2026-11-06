// full names: letters from any language, spaces, and the . ' - found in names like Ma. Dela Cruz-O'Brien.
// The backend has the same rule (schemas.py).
const NAME = /^\p{L}[\p{L}\p{M} .'’-]*$/u;

export const isValidName = (name: string) => NAME.test(name.trim());

export const NAME_ERROR = "Use letters, spaces and . ' - only";
