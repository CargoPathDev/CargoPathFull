import jwt
import datetime

# Define your RSA private key and public key here.
PRIVATE_KEY = '''-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----'''  
PUBLIC_KEY = '''-----BEGIN PUBLIC KEY-----\nYOUR_PUBLIC_KEY_HERE\n-----END PUBLIC KEY-----'''  

def create_jwt_token(subject, expiration_minutes=60):
    try:
        # Set token expiration time
        expiration_time = datetime.datetime.utcnow() + datetime.timedelta(minutes=expiration_minutes)
        payload = {
            'sub': subject,
            'iat': datetime.datetime.utcnow(),  # Issued at
            'exp': expiration_time  # Expiration time
        }
        # Generate token using RS256 algorithm
        token = jwt.encode(payload, PRIVATE_KEY, algorithm='RS256')
        return token
    except Exception as e:
        print(f'Error creating JWT token: {str(e)}')
        return None

# Example usage:
# token = create_jwt_token('your_user_id')
# print(f'Generated JWT Token: {token}')