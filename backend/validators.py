import re

def validate_email(email: str) -> bool:
    """Validate the format of an email address."""
    email_pattern = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return re.match(email_pattern, email) is not None

def sanitize_string(input_string: str) -> str:
    """Sanitize input string by removing harmful characters."""
    return re.sub(r'[^
w\s-]', '', input_string)

def validate_number(input_value) -> bool:
    """Validate if input value is a number."""
    return isinstance(input_value, (int, float))