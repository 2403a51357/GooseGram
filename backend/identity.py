import random
import string
import re

ADJECTIVES = [
    "Busy", "Curious", "Cosmic", "Lucky", "Misty", "Chaotic", "Silent", "Candid",
    "Sleepy", "Clever", "Electric", "Stellar", "Quantum", "Swift", "Gentle", "Brave",
    "Frosty", "Radiant", "Golden", "Sunny", "Whimsical", "Dynamic", "Friendly",
    "Mystic", "Vibrant", "Serene", "Cheerful", "Epic", "Bold", "Keen", "Chill",
    "Daring", "Witty", "Noble", "Zen", "Jazzy", "Hyper", "Astral", "Velvet", "Pixel",
    "Echo", "Lunar", "Solar", "Turbo", "Nimble", "Brisk", "Zesty", "Sleek", "Crisp",
    "Novel", "Prismatic", "Amber", "Cobalt", "Neon", "Emerald", "Ruby", "Shadow",
    "Silver", "Sparky", "Blazing", "Arctic", "Breezy", "Flashy", "Quiet", "Vivid",
    "Galactic", "Sonic", "Atomic", "Rustic", "Cozy", "Lively", "Spirited", "Humble"
]

NOUNS = [
    "Physics", "Succotash", "Long", "Panda", "Nebula", "Potato", "Waffle", "Algorithm",
    "Monkey", "Coffee", "Falcon", "Penguin", "Comet", "Badger", "Quasar", "Matrix",
    "Koala", "Otter", "Cactus", "Rocket", "Raven", "Wizard", "Gecko", "Fox", "Bison",
    "Spark", "Laser", "Orbit", "Proton", "Neutron", "Tiger", "Eagle", "Beaver",
    "Dolphin", "Byte", "Circuit", "Router", "Enigma", "Cosmos", "Voyager", "Phoenix",
    "Titan", "Pioneer", "Echo", "Atlas", "Beacon", "Compass", "Vortex", "Canyon",
    "Falcon", "Sparrow", "Owl", "Lynx", "Jaguar", "Horizon", "Pebble", "Summit",
    "Glacier", "Ranger", "Explorer", "Scholar", "Coder", "Nomad", "Seeker"
]

def generate_anonymous_username() -> str:
    """Generates an anonymous student username in format: Adjective_NounNumber (e.g., Misty_Titan7481 - no underscore before number)."""
    adj = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    num = random.randint(1000, 9999)
    return f"{adj}_{noun}{num}"

def generate_campus_voice_id() -> str:
    """
    Generates a unique permanent CampusVoice ID in fixed-length format:
    e.g., CV-7K2M9P4X (CV- followed by 8 characters).
    Excludes easily confusable characters (0, O, 1, I).
    """
    chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    code = "".join(random.choices(chars, k=8))
    return f"CV-{code}"

def validate_username(username: str) -> bool:
    """
    Validates username:
    - Letters, numbers, and underscores only.
    - Length between 4 and 32 characters.
    - No spaces or unusual symbols.
    """
    if not username or not isinstance(username, str):
        return False
    return bool(re.match(r"^[A-Za-z0-9_]{4,32}$", username))
