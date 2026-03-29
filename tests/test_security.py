import jwt
import unittest
from flask import Flask, request, jsonify

app = Flask(__name__)

# Sample configurations
SECRET_KEY = "your_secret_key"

# Sample user data for demonstration
user_data = {
    'username': 'test_user',
    'password': 'password123'
}

# Dummy rate limit
RATE_LIMIT = 5  # requests
rate_limit_counter = {}

@app.route('/secure-endpoint', methods=['POST'])
def secure_endpoint():
    # Example of JWT token validation
    token = request.cookies.get('jwt')
    if not token:
        return jsonify({"message": "Missing JWT token"}), 401
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return jsonify({"message": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"message": "Invalid token"}), 401

    # Check rate limiting
    ip = request.remote_addr
    if ip in rate_limit_counter:
        rate_limit_counter[ip] += 1
    else:
        rate_limit_counter[ip] = 1

    if rate_limit_counter[ip] > RATE_LIMIT:
        return jsonify({"message": "Rate limit exceeded"}), 429

    return jsonify({"message": "Access granted"}), 200

class SecurityTests(unittest.TestCase):

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        self.token = jwt.encode({'username': user_data['username']}, SECRET_KEY, algorithm='HS256')

    def test_missing_jwt(self):
        response = self.app.post('/secure-endpoint', cookies={})
        self.assertEqual(response.status_code, 401)
        self.assertIn("Missing JWT token", response.get_data(as_text=True))

    def test_invalid_jwt(self):
        response = self.app.post('/secure-endpoint', cookies={'jwt': 'invalid_token'})
        self.assertEqual(response.status_code, 401)
        self.assertIn("Invalid token", response.get_data(as_text=True))

    def test_expired_jwt(self):
        expired_token = jwt.encode({'username': user_data['username'], 'exp': 0}, SECRET_KEY, algorithm='HS256')
        response = self.app.post('/secure-endpoint', cookies={'jwt': expired_token})
        self.assertEqual(response.status_code, 401)
        self.assertIn("Token expired", response.get_data(as_text=True))

    def test_rate_limiting(self):
        for _ in range(RATE_LIMIT):
            response = self.app.post('/secure-endpoint', cookies={'jwt': self.token})
            self.assertEqual(response.status_code, 200)

        response = self.app.post('/secure-endpoint', cookies={'jwt': self.token})
        self.assertEqual(response.status_code, 429)
        self.assertIn("Rate limit exceeded", response.get_data(as_text=True))

    def test_input_validation(self):
        response = self.app.post('/secure-endpoint', json={'field': '<script>alert(1)</script>'}, cookies={'jwt': self.token})
        self.assertEqual(response.status_code, 200)
        # Here you would typically check for expected output that means validation worked.

if __name__ == '__main__':
    unittest.main()