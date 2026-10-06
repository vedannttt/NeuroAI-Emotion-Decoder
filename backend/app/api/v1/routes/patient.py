"""
Patient Dashboard API Routes
All routes require role='user' authentication (patients only).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from typing import List

from app.api.v1.deps import current_user, require_role
from app.database.models import User, SessionNote, Appointment, DoctorAlert
from app.database.session import get_db
from app.schemas.contracts import (
    PatientSessionNoteOut, PatientAppointmentOut, RescheduleRequest
)

router = APIRouter(prefix='/patient', tags=['Patient Dashboard'])
patient_only = require_role('user')


@router.get('/my-session-notes', response_model=List[PatientSessionNoteOut])
async def my_session_notes(
    patient: User = Depends(patient_only),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(SessionNote, User.full_name)
            .join(User, SessionNote.doctor_id == User.id)
            .where(SessionNote.patient_id == patient.id)
            .order_by(desc(SessionNote.session_date), desc(SessionNote.created_at))
        )
    ).all()

    result = []
    for note, doctor_name in rows:
        result.append(PatientSessionNoteOut(
            id=note.id,
            doctor_name=doctor_name or 'Doctor',
            content=note.content,
            is_draft=note.is_draft,
            session_date=note.session_date,
            created_at=note.created_at,
            updated_at=note.updated_at,
        ))
    return result


@router.get('/my-appointments', response_model=List[PatientAppointmentOut])
async def my_appointments(
    patient: User = Depends(patient_only),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(Appointment, User.full_name)
            .join(User, Appointment.doctor_id == User.id)
            .where(Appointment.patient_id == patient.id)
            .order_by(Appointment.scheduled_at.desc())
        )
    ).all()

    result = []
    for appt, doctor_name in rows:
        result.append(PatientAppointmentOut(
            id=appt.id,
            doctor_name=doctor_name or 'Doctor',
            scheduled_at=appt.scheduled_at,
            appointment_type=appt.appointment_type,
            notes=appt.notes,
            status=appt.status,
            patient_message=getattr(appt, 'patient_message', None),
            created_at=appt.created_at,
        ))
    return result


@router.post('/appointments/{appt_id}/request-reschedule', response_model=PatientAppointmentOut)
async def request_reschedule(
    appt_id: int,
    payload: RescheduleRequest,
    patient: User = Depends(patient_only),
    db: AsyncSession = Depends(get_db),
):
    appt = (
        await db.execute(
            select(Appointment).where(
                Appointment.id == appt_id,
                Appointment.patient_id == patient.id,
            )
        )
    ).scalar_one_or_none()
    if not appt:
        raise HTTPException(404, 'Appointment not found')
    if appt.status not in ('scheduled',):
        raise HTTPException(400, 'Only scheduled appointments can be rescheduled')

    appt.scheduled_at = payload.scheduled_at
    appt.status = 'reschedule_requested'
    if not getattr(appt, 'patient_message', None):
        appt.patient_message = payload.patient_message
    else:
        appt.patient_message = f"{appt.patient_message}\nPatient message: {payload.patient_message}"

    await db.commit()
    await db.refresh(appt)
    doctor = (
        await db.execute(select(User.full_name).where(User.id == appt.doctor_id))
    ).scalar_one_or_none()

    return PatientAppointmentOut(
        id=appt.id,
        doctor_name=doctor or 'Doctor',
        scheduled_at=appt.scheduled_at,
        appointment_type=appt.appointment_type,
        notes=appt.notes,
        status=appt.status,
        patient_message=getattr(appt, 'patient_message', None),
        created_at=appt.created_at,
    )
