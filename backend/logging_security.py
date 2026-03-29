import logging
import os
from datetime import datetime

# Configure the logger
logging.basicConfig(
    filename='security_events.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

class SecurityLogger:
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def log_event(self, event_message):
        # Logging security events
        self.logger.info(f'SECURITY EVENT: {event_message}')

    def log_error(self, error_message):
        # Logging errors and exceptions
        self.logger.error(f'ERROR: {error_message}')

    def log_audit_trail(self, action_performed, user):
        # Logging audit trail with masked user details
        masked_user = self.mask_sensitive_info(user)
        self.logger.info(f'AUDIT TRAIL: User {masked_user} performed action: {action_performed}')

    def mask_sensitive_info(self, user):
        # Masking sensitive information
        return user[:3] + '*' * (len(user) - 3)

# Example usage:
security_logger = SecurityLogger()
security_logger.log_event('User login attempt.')
security_logger.log_audit_trail('Login', os.getenv('USER_NAME', 'unknown_user'))

try:
    # Simulated sensitive operation that could fail
    result = 10 / 0
except Exception as e:
    security_logger.log_error(str(e))
