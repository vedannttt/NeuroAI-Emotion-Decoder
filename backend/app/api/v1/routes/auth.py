from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import current_user
from app.core.config import settings
from app.core.security import create_token, decode_token, hash_password, verify_password
from app.database.models import AuditLog, User
from app.database.session import get_db
from app.schemas.contracts import (
    LoginRequest, DoctorLoginRequest, RegisterRequest, DoctorRegisterRequest,
    TokenPair, UserProfile, UpdateProfileRequest
)

router = APIRouter(prefix='/auth', tags=['Authentication'])

def tokens(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_token(str(user.id), user.role, timedelta(minutes=settings.access_token_expire_minutes), 'access'),
        refresh_token=create_token(str(user.id), user.role, timedelta(days=settings.refresh_token_expire_days), 'refresh'),
    )

# ─── Patient Registration ────────────────────────────────────────────────────
@router.post('/register', response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if (await db.execute(select(User).where(User.email == payload.email.lower()))).scalar_one_or_none():
        raise HTTPException(409, 'Email is already registered')
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role='user',
    )
    db.add(user)
    await db.flush()
    db.add(AuditLog(user_id=user.id, action='register'))
    await db.commit()
    return tokens(user)

# ─── Doctor Registration ─────────────────────────────────────────────────────
@router.post('/doctor-register', response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def doctor_register(payload: DoctorRegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check email uniqueness
    if (await db.execute(select(User).where(User.email == payload.email.lower()))).scalar_one_or_none():
        raise HTTPException(409, 'Email is already registered')
    # Check doctor_id uniqueness
    if (await db.execute(select(User).where(User.doctor_id == payload.doctor_id))).scalar_one_or_none():
        raise HTTPException(409, 'Doctor ID is already registered')
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role='doctor',
        doctor_id=payload.doctor_id,
    )
    db.add(user)
    await db.flush()
    db.add(AuditLog(user_id=user.id, action='doctor_register', detail=f'doctor_id={payload.doctor_id}'))
    await db.commit()
    return tokens(user)

# ─── Patient Login ───────────────────────────────────────────────────────────
@router.post('/login', response_model=TokenPair)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == payload.email.lower()))).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, 'Invalid email or password')
    db.add(AuditLog(user_id=user.id, action='login'))
    await db.commit()
    return tokens(user)

# ─── Doctor Login ────────────────────────────────────────────────────────────
@router.post('/doctor-login', response_model=TokenPair)
async def doctor_login(payload: DoctorLoginRequest, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == payload.email.lower()))).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, 'Invalid email or password')
    if user.role != 'doctor':
        raise HTTPException(403, 'This account is not registered as a doctor. Please use the patient login.')
    if not user.doctor_id or user.doctor_id.lower() != payload.doctor_id.lower():
        raise HTTPException(403, 'Invalid Doctor ID for this account')
    db.add(AuditLog(user_id=user.id, action='doctor_login'))
    await db.commit()
    return tokens(user)

# ─── Token Refresh ───────────────────────────────────────────────────────────
@router.post('/refresh', response_model=TokenPair)
async def refresh(refresh_token: str, db: AsyncSession = Depends(get_db)):
    payload = decode_token(refresh_token, 'refresh')
    user = (await db.execute(select(User).where(User.id == int(payload['sub'])))).scalar_one_or_none()
    if not user: raise HTTPException(401, 'Unknown user')
    return tokens(user)

# ─── Logout ──────────────────────────────────────────────────────────────────
@router.post('/logout', status_code=204)
async def logout(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    db.add(AuditLog(user_id=user.id, action='logout'))
    await db.commit()

# ─── Profile ─────────────────────────────────────────────────────────────────
@router.get('/me', response_model=UserProfile)
async def me(user: User = Depends(current_user)):
    """Return the authenticated account profile for frontend session hydration."""
    return UserProfile(id=user.id, full_name=user.full_name, email=user.email, role=user.role, doctor_id=user.doctor_id)

@router.put('/profile', response_model=UserProfile)
@router.post('/profile', response_model=UserProfile)
async def update_profile(payload: UpdateProfileRequest, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    user.full_name = payload.full_name.strip()
    db.add(AuditLog(user_id=user.id, action='update_profile'))
    await db.commit()
    await db.refresh(user)
    return UserProfile(id=user.id, full_name=user.full_name, email=user.email, role=user.role, doctor_id=user.doctor_id)
