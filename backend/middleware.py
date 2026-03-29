from django.utils.decorators import decorator_from_middleware
from django.middleware.security import SecurityMiddleware
from django.middleware.common import CommonMiddleware
from corsheaders.middleware import CorsMiddleware
from ratelimit.decorators import ratelimit

# Rate Limiting Middleware
@decorator_from_middleware(ratelimit).
def rate_limit_view(view_func):
    return view_func

# CORS Middleware
class CustomCorsMiddleware(CorsMiddleware):
    def process_response(self, request, response):
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        return response

# Security Headers Middleware
class SecurityHeadersMiddleware(SecurityMiddleware):
    def process_response(self, request, response):
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        return response

# Add Middlewares to Django Settings
MIDDLEWARE = [
    'path.to.CustomCorsMiddleware',
    'path.to.SecurityHeadersMiddleware',
    'path.to.rate_limit_view',
    # ... other middleware ...
]