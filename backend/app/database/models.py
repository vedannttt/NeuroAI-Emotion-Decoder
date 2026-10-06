from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from typing import Optional

class Base(DeclarativeBase): pass

class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(30), default='user')
    doctor_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class AnalysisHistory(Base):
    __tablename__ = 'analysis_history'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    report_type: Mapped[str] = mapped_column(String(30))
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class PHQReport(Base):
    __tablename__ = 'phq_reports'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    score: Mapped[int] = mapped_column(Integer)
    severity: Mapped[str] = mapped_column(String(40))
    answers: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class EmotionReport(Base):
    __tablename__ = 'emotion_reports'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    emotion: Mapped[str] = mapped_column(String(60))
    confidence: Mapped[float] = mapped_column(Float)
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class VoiceReport(Base):
    __tablename__ = 'voice_reports'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    emotion: Mapped[str] = mapped_column(String(60))
    confidence: Mapped[float] = mapped_column(Float)
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Setting(Base):
    __tablename__ = 'settings'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), unique=True)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'), nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

# ─── Doctor-Specific Models ─────────────────────────────────────────────────

class SessionNote(Base):
    """SOAP/DAP clinical note created by a doctor for a patient session."""
    __tablename__ = 'session_notes'
    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    content: Mapped[dict] = mapped_column(JSON)          # {subjective, objective, assessment, plan}
    is_draft: Mapped[bool] = mapped_column(Boolean, default=True)
    session_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Appointment(Base):
    """Scheduled appointment or follow-up between doctor and patient."""
    __tablename__ = 'appointments'
    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    appointment_type: Mapped[str] = mapped_column(String(60), default='consultation')
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    patient_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default='scheduled')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class DoctorAlert(Base):
    """Notification for doctor when a patient submits a new analysis."""
    __tablename__ = 'doctor_alerts'
    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    alert_type: Mapped[str] = mapped_column(String(60))  # new_checkin, high_risk, phq9_submitted, etc.
    message: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), default='info')  # info, warning, critical
    seen: Mapped[bool] = mapped_column(Boolean, default=False)
    analysis_id: Mapped[Optional[int]] = mapped_column(ForeignKey('analysis_history.id'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

