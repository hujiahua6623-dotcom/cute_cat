import uuid


def new_id(prefix: str) -> str:
    """Generate opaque string IDs used in API responses (e.g. usr_..., pet_...)."""
    return f"{prefix}_{uuid.uuid4().hex[:16]}"
