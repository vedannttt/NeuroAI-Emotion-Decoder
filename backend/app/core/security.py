import bcrypt
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import HTTPException, status
from app.core.config import settings

ALGORITHM = 'HS256'
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
def verify_password(password: str, hashed: str) -> bool:
    try: return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception: return False
def create_token(subject: str, role: str, expires: timedelta, token_type: str) -> str:
    payload = {'sub': subject, 'role': role, 'type': token_type, 'exp': datetime.now(timezone.utc) + expires}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
def decode_token(token: str, expected_type: str = 'access') -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        if payload.get('type') != expected_type or not payload.get('sub'): raise JWTError()
        return payload
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired token') from exc
