from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import decode_token
from app.database.models import User
from app.database.session import get_db
bearer=HTTPBearer()
async def current_user(credentials: HTTPAuthorizationCredentials=Depends(bearer), db: AsyncSession=Depends(get_db)) -> User:
    payload=decode_token(credentials.credentials)
    user=(await db.execute(select(User).where(User.id==int(payload['sub'])))).scalar_one_or_none()
    if not user or not user.is_active: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail='Inactive account')
    return user
def require_role(*roles):
    async def guard(user:User=Depends(current_user)):
        if user.role not in roles: raise HTTPException(status_code=403,detail='Insufficient permissions')
        return user
    return guard
