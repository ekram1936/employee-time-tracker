import httpx
from app.config import settings

ZEROBOUNCE_URL = "https://api.zerobounce.net/v2/validate"

BLOCKED_STATUSES = {
    "invalid":     "This email address doesn't exist.",
    "disposable":  "Disposable email addresses are not allowed.",
    "spamtrap":    "This email address cannot be used.",
    "abuse":       "This email address cannot be used.",
    "do_not_mail": "This email address cannot be used.",
}

ALLOWED_SHORT_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "icloud.com", "me.com", "mac.com", "live.com", "msn.com",
    "gmx.com", "gmx.net", "proton.me", "protonmail.com",
}


def is_suspicious_email(email: str) -> tuple[bool, str]:
    local, _, domain = email.partition("@")
    domain = domain.lower()
    parts = domain.split(".")

    if len(local) < 3:
        return True, "Please enter a valid email address."

    if len(parts) < 2 or len(parts[-1]) < 2:
        return True, "Please enter a valid email address."

    if domain in ALLOWED_SHORT_DOMAINS:
        return False, ""

    if len(parts[0]) < 4:
        return True, "Please enter a valid email address."

    return False, ""


def validate_email_address(email: str) -> tuple[bool, str]:
    # ── Step 1: Sanity check ──────────────────────────────────────────────────
    suspicious, msg = is_suspicious_email(email)
    if suspicious:
        return False, msg

    # ── Step 2: ZeroBounce (sync) ─────────────────────────────────────────────
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(ZEROBOUNCE_URL, params={
                "api_key":    settings.ZEROBOUNCE_API_KEY,
                "email":      email,
                "ip_address": "",
            })
            resp.raise_for_status()
            data = resp.json()

        status = data.get("status", "").lower()
        sub_status = data.get("sub_status", "").lower()

        print(f"DEBUG ZeroBounce → status={status} sub_status={sub_status}")

        if sub_status == "disposable":
            return False, "Disposable email addresses are not allowed."

        if status in BLOCKED_STATUSES:
            return False, BLOCKED_STATUSES[status]

        return True, ""

    except httpx.TimeoutException:
        print("DEBUG ZeroBounce → timeout, failing open")
        return True, ""
    except Exception as e:
        print(f"DEBUG ZeroBounce ERROR → {e}")
        return True, ""
