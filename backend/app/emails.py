"""Email check for every form that takes an email (frontend/src/lib/email.ts has the same rule).

- the part after the last dot needs 2+ letters, so juan@gmail.c is refused
- near-misses of the big providers are caught with a suggestion: gmail.co, gmail.con, gmial.com -> gmail.com
"""

import re

FORMAT = re.compile(r"^[^\s@]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$", re.IGNORECASE)

# provider name -> the domains it really uses (first one is suggested)
PROVIDERS = {
    "gmail": ["gmail.com"],
    "yahoo": ["yahoo.com", "yahoo.com.ph"],
    "outlook": ["outlook.com", "outlook.ph"],
    "hotmail": ["hotmail.com"],
    "icloud": ["icloud.com"],
}
# real providers that are one letter away from one above
ALSO_REAL = {"email", "mail", "ymail", "gmx"}

EMAIL_ERROR = "Enter a valid email like juan@gmail.com"


def distance(a: str, b: str) -> int:
    # letters added, removed, changed or swapped (gmial -> gmail is 1)
    d = [[i + j if i * j == 0 else 0 for j in range(len(b) + 1)] for i in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] != b[j - 1]))
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[len(a)][len(b)]


def suggest_domain(domain: str) -> str | None:
    d = domain.lower()
    name = d.split(".")[0]
    for provider, domains in PROVIDERS.items():
        if d in domains:
            return None
        if name == provider:
            return domains[0]
        if name not in ALSO_REAL and distance(name, provider) <= (2 if len(provider) >= 6 else 1):
            return domains[0]
    return None


def check_email(value: str | None) -> str | None:
    """pydantic validator: raises with the message to show, returns the trimmed email"""
    if value is None:
        return None
    email = value.strip()
    if email.count("@") == 1:
        local, domain = email.split("@")
        fix = suggest_domain(domain) if local and domain else None
        if fix:
            raise ValueError(f"Did you mean {local}@{fix}?")
    if not FORMAT.match(email):
        raise ValueError(EMAIL_ERROR)
    return email
