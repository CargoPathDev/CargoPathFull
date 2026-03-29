# Security Configurations

# Configuration for secure password storage
PASSWORD_HASH_ALGORITHM = 'bcrypt'
PASSWORD_HASH_ROUNDS = 12

# Enable HTTPS for secure communication
ENABLE_HTTPS = True

# Configuration for CSRF protection
CSRF_ENABLED = True
CSRF_SECRET_KEY = 'your_csrf_secret_key_here'

# Configuration for CORS policy
CORS_ORIGINS = ['https://yourdomain.com']

# Configuration for JWT
JWT_SECRET_KEY = 'your_jwt_secret_key_here'
JWT_EXPIRATION_DELTA = timedelta(days=7)