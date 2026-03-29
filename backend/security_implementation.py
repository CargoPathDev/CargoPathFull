import os
import jwt
from flask import Flask, request, jsonify, make_response
from flask_limiter import Limiter
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

# Rate Limiting Setup
limiter = Limiter(app, key_func=lambda: request.remote_addr)

# Load the JWT secret from environment variables for security
JWT_SECRET = os.environ.get('JWT_SECRET', 'your_default_secret')

# Secure cookie configuration
@app.after_request
def add_security_headers(response):
    response.set_cookie('session_id', 'your_session_id', httponly=True, secure=True, samesite='Strict')
    return response

# Input validation example
@app.route('/secure-endpoint', methods=['POST'])
@limiter.limit('5 per minute')
def secure_endpoint():
    data = request.json
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Invalid input'}), 400
    
    # Continue with business logic...

# Function to create JWT
def create_jwt(user_id):
    token = jwt.encode({'user_id': user_id}, JWT_SECRET, algorithm='HS256')
    return token

# Function to decode JWT
def decode_jwt(token):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return {'error': 'Token expired'}
    except jwt.InvalidTokenError:
        return {'error': 'Invalid token'}

if __name__ == '__main__':
    app.run(debug=False)
