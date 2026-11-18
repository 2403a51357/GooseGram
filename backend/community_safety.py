"""
CampusVoice Anti-Deanonymization Community Safety Engine
-------------------------------------------------------
Validates community creation requests to enforce strict student anonymity.
Prohibits creation of micro-cohorts (academic sections, specific hostel rooms/blocks,
roll number sequences, branch cohorts) while welcoming broad campus culture hubs.
$0 cost - runs purely in Python with no external AI APIs.
"""

import re

LEET_MAP = {
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '8': 'b',
    '@': 'a',
    '$': 's'
}

BRANCHES = r'(cse|ece|eee|mech|civil|it|aiml|aids|csit|biotech|mba|bba|mca)'

ALLOWED_CATEGORIES = [
    'Campus Life',
    'Tech & Coding',
    'Career & Jobs',
    'Creative & Arts',
    'Gaming & Hobbies',
    'Sports & Fitness',
    'Academics',
    'General'
]

# Patterns checked against raw alphanumeric string
RAW_FORBIDDEN_PATTERNS = [
    # Standalone branch names (e.g., cse, eee, mech)
    re.compile(rf'^{BRANCHES}$'),
    # Branch + Section or Year: e.g. cseb, ece2, mechsecb, cse3rdyear, cse-a
    re.compile(rf'{BRANCHES}(sec|section|div|year|yr|[0-9]|[a-z])'),
    # Academic section indicators: e.g. secb, sectiona, sec1, divc
    re.compile(r'(sec|section|div|division)[0-9a-z]{1,3}'),
    # Hostel references (user explicitly forbade revealing living situation)
    re.compile(r'hostel'),
    # Specific rooms or floor addresses: e.g. rm302, room104, floor2
    re.compile(r'(room|rm|floor|flr)[0-9]{1,4}'),
    # Specific blocks or wings: e.g. blocka, blk3
    re.compile(r'(block|blk)[a-z0-9]{1,4}'),
    # Roll numbers or student ID sequences: e.g. 2403a51333, 21b91a0501
    re.compile(r'[0-9]{2,}[a-z]{1,3}[0-9]{2,}'),
    # Standalone large numbers (e.g., batch years or room numbers like 2024, 3021)
    re.compile(r'^[0-9]{3,}$'),
    # Roll number ranges: e.g. 101to150, 01-60
    re.compile(r'[0-9]{2,}(to|-)[0-9]{2,}'),
]

# Patterns checked against leetspeak-substituted string
LEET_FORBIDDEN_PATTERNS = [
    # Leetspeak branch attempts: e.g. cs3, 3c3
    re.compile(rf'^{BRANCHES}$'),
    # Leetspeak branch + section
    re.compile(rf'{BRANCHES}(sec|section|div|year|yr|[a-z])'),
    # Leetspeak sections: e.g. s3c-b -> secb
    re.compile(r'(sec|section|div|division)[a-z]{1,3}'),
    # Leetspeak hostel: e.g. h0st3l -> hostel
    re.compile(r'hostel'),
    # Leetspeak rooms/blocks: e.g. bl0ck -> block
    re.compile(r'(room|rm|block|blk)[0-9a-z]{1,4}'),
]


def slugify(text: str) -> str:
    """Converts a community name into a clean URL-friendly slug."""
    text = (text or '').lower().strip()
    slug = re.sub(r'[^a-z0-9]+', '-', text).strip('-')
    slug = re.sub(r'-+', '-', slug)
    return slug


def validate_community(name: str, slug: str = None, description: str = '', category: str = 'Campus Life'):
    """
    Validates community name, handle slug, description, and category.
    Returns (is_valid: bool, error_message: str or None, clean_slug: str).
    """
    clean_name = (name or '').strip()

    if not clean_name:
        return False, 'Community name is required.', None

    if len(clean_name) < 3 or len(clean_name) > 35:
        return False, 'Community name must be between 3 and 35 characters.', None

    # Slug validation
    target_slug = slug if (slug and slug.strip()) else clean_name
    clean_slug = slugify(target_slug)

    if not clean_slug or len(clean_slug) < 3 or len(clean_slug) > 35:
        return False, 'Community handle (slug) must be between 3 and 35 characters (e.g. boys-backbenchers).', None

    if category not in ALLOWED_CATEGORIES:
        category = 'Campus Life'

    if description and len(description.strip()) > 500:
        return False, 'Community description cannot exceed 500 characters.', None

    # Normalize name and slug for safety checks
    name_and_slug = f"{clean_name} {clean_slug}".lower()

    # 1. Raw collapsed check (letters and digits only)
    raw_collapsed = re.sub(r'[^a-z0-9]', '', name_and_slug)
    for pattern in RAW_FORBIDDEN_PATTERNS:
        if pattern.search(raw_collapsed):
            return (
                False,
                'This community name appears to target a specific academic section, branch cohort, hostel room, or student ID. '
                'To safeguard student anonymity, communities must be broad campus culture or topic hubs (e.g., c/BoysBackbenchers, c/WebDev, c/CampusMemes).',
                None
            )

    # 2. Leetspeak collapsed check
    leet_text = name_and_slug
    for char, rep in LEET_MAP.items():
        leet_text = leet_text.replace(char, rep)
    leet_collapsed = re.sub(r'[^a-z0-9]', '', leet_text)

    for pattern in LEET_FORBIDDEN_PATTERNS:
        if pattern.search(leet_collapsed):
            return (
                False,
                'This community name appears to target a specific academic section, branch cohort, hostel room, or student ID. '
                'To safeguard student anonymity, communities must be broad campus culture or topic hubs (e.g., c/BoysBackbenchers, c/WebDev, c/CampusMemes).',
                None
            )

    return True, None, clean_slug
