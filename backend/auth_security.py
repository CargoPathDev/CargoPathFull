import bcrypt
from datetime import datetime, timedelta
from collections import defaultdict

class AccountLockout:
    def __init__(self, lockout_duration=timedelta(minutes=15):
        self.failed_attempts = defaultdict(int)
        self.lockout_duration = lockout_duration
        self.locked_users = {}

    def login_failed(self, username):
        self.failed_attempts[username] += 1
        if self.failed_attempts[username] >= 5:
            self.locked_users[username] = datetime.now()

    def is_locked(self, username):
        if username in self.locked_users:
            lock_time = self.locked_users[username]
            if datetime.now() - lock_time < self.lockout_duration:
                return True
            else:
                del self.locked_users[username]  # unlock the account after the duration
        return False

class PasswordManager:
    @staticmethod
    def hash_password(password):
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt())

    @staticmethod
    def check_password_hash(password, hashed):
        return bcrypt.checkpw(password.encode(), hashed)

    @staticmethod
    def is_strong_password(password):
        return (len(password) >= 8 and
                any(c.isdigit() for c in password) and
                any(c.isupper() for c in password) and
                any(c.islower() for c in password) and
                any(c in "@#$%^&+=" for c in password))


# Example usage:
# lockout = AccountLockout()
# lockout.login_failed(user)
# if lockout.is_locked(user):
#     print(f"User {user} is locked out.")
# hashed = PasswordManager.hash_password(password)
# if PasswordManager.check_password_hash(password, hashed):
#     print("Password is correct!")

