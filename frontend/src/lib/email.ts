// Email check used by every form that takes an email (backend/app/emails.py has the same rule).
// - the part after the last dot needs 2+ letters, so juan@gmail.c is refused
// - near-misses of the big providers are caught with a suggestion: gmail.co, gmail.con, gmial.com -> gmail.com

const FORMAT = /^[^\s@]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

// provider name -> the domains it really uses (first one is suggested)
const PROVIDERS: Record<string, string[]> = {
  gmail: ['gmail.com'],
  yahoo: ['yahoo.com', 'yahoo.com.ph'],
  outlook: ['outlook.com', 'outlook.ph'],
  hotmail: ['hotmail.com'],
  icloud: ['icloud.com'],
};
// real providers that are one letter away from one above
const ALSO_REAL = new Set(['email', 'mail', 'ymail', 'gmx']);

export const EMAIL_ERROR = 'Enter a valid email like juan@gmail.com';

// letters added, removed, changed or swapped (gmial -> gmail is 1)
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i * j === 0 ? i + j : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// the right domain when this one looks like a typo of a big provider, otherwise null
export function suggestDomain(domain: string): string | null {
  const d = domain.toLowerCase();
  const name = d.split('.')[0];
  for (const [provider, domains] of Object.entries(PROVIDERS)) {
    if (domains.includes(d)) return null;
    // gmail.c, gmail.co, gmail.con: right name, wrong ending
    if (name === provider) return domains[0];
    // gmial.com, gmai.com, gnail.com: name one or two letters off
    if (!ALSO_REAL.has(name) && distance(name, provider) <= (provider.length >= 6 ? 2 : 1)) return domains[0];
  }
  return null;
}

// null when the email is fine, otherwise the message to show
export function emailError(value: string, { typos = true } = {}): string | null {
  const email = value.trim();
  if (!email) return 'Please enter your email';
  const parts = email.split('@');
  if (typos && parts.length === 2 && parts[0] && parts[1]) {
    const fix = suggestDomain(parts[1]);
    if (fix) return `Did you mean ${parts[0]}@${fix}?`;
  }
  return FORMAT.test(email) ? null : EMAIL_ERROR;
}
