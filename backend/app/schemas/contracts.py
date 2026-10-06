from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator

# ─── Auth ───────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

class DoctorRegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    doctor_id: str = Field(min_length=3, max_length=80, description="Doctor license / ID number")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class DoctorLoginRequest(BaseModel):
    email: EmailStr
    password: str
    doctor_id: str = Field(min_length=3, max_length=80, description="Doctor license / ID number")

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'

class UserProfile(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    doctor_id: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)

# ─── Analysis Requests ───────────────────────────────────────────────────────
class TextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)

    @field_validator('text')
    @classmethod
    def normalize(cls, v): return ' '.join(v.strip().split())

class PHQ9Request(BaseModel):
    answers: list[int] = Field(min_length=9, max_length=9)

    @field_validator('answers')
    @classmethod
    def valid_scores(cls, v):
        if any(x not in (0, 1, 2, 3) for x in v): raise ValueError('Each PHQ-9 answer must be 0, 1, 2, or 3')
        return v

class FusionRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    phq_answers: list[int] = Field(min_length=9, max_length=9)
    voice_emotion: str | None = None
    voice_confidence: float | None = Field(default=None, ge=0, le=1)

    @field_validator('phq_answers')
    @classmethod
    def valid_phq_scores(cls, v):
        if any(x not in (0, 1, 2, 3) for x in v): raise ValueError('Each PHQ-9 answer must be 0, 1, 2, or 3')
        return v

# ─── Doctor Dashboard Schemas ─────────────────────────────────────────────────
class PatientSummary(BaseModel):
    id: int
    full_name: str
    email: str
    last_checkin: Optional[datetime] = None
    total_analyses: int = 0
    latest_emotion: Optional[str] = None
    latest_stress: Optional[str] = None
    latest_phq_score: Optional[int] = None
    latest_phq_severity: Optional[str] = None
    risk_level: Optional[str] = None
    trend: str = 'stable'           # improving | deteriorating | stable
    status: str = 'ok'              # ok | needs_attention | critical
    unread_alerts: int = 0

class PatientHistoryItem(BaseModel):
    id: int
    report_type: str
    result: dict
    created_at: datetime

class PatientDetail(BaseModel):
    id: int
    full_name: str
    email: str
    created_at: Optional[datetime] = None
    history: List[PatientHistoryItem] = []
    notes: List[dict] = []
    appointments: List[dict] = []

class PreSessionBriefOut(BaseModel):
    patient_id: int
    patient_name: str
    period_days: int
    total_sessions: int
    emotion_trend: str
    stress_trend: str
    phq9_change: Optional[str] = None
    phq9_current_score: Optional[int] = None
    phq9_previous_score: Optional[int] = None
    risk_level: str
    important_changes: List[str]
    suggested_topics: List[str]
    summary: str

class SessionNoteCreate(BaseModel):
    patient_id: int
    subjective: str = Field(default='', max_length=4000)
    objective: str = Field(default='', max_length=4000)
    assessment: str = Field(default='', max_length=4000)
    plan: str = Field(default='', max_length=4000)
    is_draft: bool = True
    session_date: Optional[datetime] = None

class SessionNoteOut(BaseModel):
    id: int
    doctor_id: int
    patient_id: int
    content: dict
    is_draft: bool
    session_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class AppointmentCreate(BaseModel):
    patient_id: int
    scheduled_at: datetime
    appointment_type: str = Field(default='consultation')
    notes: Optional[str] = Field(default=None, max_length=1000)

class AppointmentUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

class AppointmentOut(BaseModel):
    id: int
    doctor_id: int
    patient_id: int
    patient_name: Optional[str] = None
    scheduled_at: datetime
    appointment_type: str
    notes: Optional[str] = None
    status: str
    created_at: datetime

class AlertOut(BaseModel):
    id: int
    patient_id: int
    patient_name: Optional[str] = None
    alert_type: str
    message: str
    severity: str
    seen: bool
    analysis_id: Optional[int] = None
    created_at: datetime

class DoctorStats(BaseModel):
    total_patients: int
    needs_attention: int
    critical: int
    todays_appointments: int
    unread_alerts: int
    total_notes: int

class CopilotQuery(BaseModel):
    patient_id: int
    question: str = Field(min_length=3, max_length=500)

class CopilotResponse(BaseModel):
    answer: str
    sources: List[str] = []
    confidence: str = 'medium'

# ─── Patient Dashboard Schemas ─────────────────────────────────────────────────
class PatientSessionNoteOut(BaseModel):
    id: int
    doctor_name: str
    content: dict
    is_draft: bool
    session_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class PatientAppointmentOut(BaseModel):
    id: int
    doctor_name: str
    scheduled_at: datetime
    appointment_type: str
    notes: Optional[str] = None
    status: str
    patient_message: Optional[str] = None
    created_at: datetime

class RescheduleRequest(BaseModel):
    scheduled_at: datetime
    patient_message: str = Field(default='', max_length=1000)
