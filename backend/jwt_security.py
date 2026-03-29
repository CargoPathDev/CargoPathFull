import jwt
from datetime import datetime, timezone, timedelta
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import os

RSA_PRIVATE_KEY = os.environ.get('RSA_PRIVATE_KEY')
RSA_PUBLIC_KEY = os.environ.get('RSA_PUBLIC_KEY')

JWT_ALGORITHM = 'RS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        'sub': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        'iat': datetime.now(timezone.utc),
        'type': 'access'
    }
    token = jwt.encode(payload, RSA_PRIVATE_KEY, algorithm=JWT_ALGORITHM)
    return token

def create_refresh_token(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        'iat': datetime.now(timezone.utc),
        'type': 'refresh'
    }
    token = jwt.encode(payload, RSA_PRIVATE_KEY, algorithm=JWT_ALGORITHM)
    return token

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, RSA_PUBLIC_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError('Token expired')
    except jwt.InvalidTokenError:
        raise ValueError('Invalid token')

def generate_rsa_keys():
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return private_pem.decode(), public_pem.decode()