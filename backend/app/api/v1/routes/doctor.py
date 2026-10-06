"""
Doctor Dashboard API Routes
All routes require role='doctor' authentication.
Patients can never access these endpoints.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import current_user, require_role
from app.database.models import (
    User, AnalysisHistory, SessionNote, Appointment, DoctorAlert, AuditLog
)
from app.database.session import get_db
from app.schemas.contracts import (
    PatientSummary, PatientDetail, PatientHistoryItem,
    PreSessionBriefOut, SessionNoteCreate, SessionNoteOut,
    AppointmentCreate, AppointmentUpdate, AppointmentOut,
    AlertOut, DoctorStats, CopilotQuery, CopilotResponse
)

router = APIRouter(prefix='/doctor', tags=['Doctor Dashboard'])
doctor_only = require_role('doctor')


# ─── Helper: build patient status from history ───────────────────────────────
def _compute_patient_status(history: list) -> dict:
    """Compute status, trend, risk from a patient's analysis history."""
    if not history:
        return {
            'status': 'ok', 'trend': 'stable', 'risk_level': 'Low',
            'latest_phq_score': None, 'latest_phq_severity': None,
            'latest_emotion': None, 'latest_stress': None,
        }

    recent = history[:5]
    emotions_negative = {'sad', 'fear', 'anger', 'disgust', 'grief', 'anxious', 'depressed'}

    # PHQ trend
    phq_scores = [
        r.result.get('phq_score') or r.result.get('score')
        for r in history if r.report_type in ('phq9', 'fusion') and (r.result.get('phq_score') or r.result.get('score'))
    ]

    # Stress trend
    stress_values = [r.result.get('stress_level', '') for r in recent]
    high_stress = stress_values.count('High')

    # Emotion trend
    negative_count = sum(
        1 for r in recent
        if (r.result.get('overall_emotion') or r.result.get('emotion') or '').lower() in emotions_negative
    )

    # Risk indicators
    risk_keywords = [r.result.get('risk_level', r.result.get('suicide_risk', '')) for r in recent]
    critical_risk = any(str(r).lower() in ('high', 'critical', 'severe') for r in risk_keywords)

    # PHQ change
    phq_trend = 'stable'
    if len(phq_scores) >= 2:
        if phq_scores[0] > phq_scores[1] + 2:
            phq_trend = 'deteriorating'
        elif phq_scores[0] < phq_scores[1] - 2:
            phq_trend = 'improving'

    # Overall status
    if critical_risk or high_stress >= 3 or negative_count >= 4:
        status_val = 'critical'
    elif high_stress >= 2 or negative_count >= 3 or phq_trend == 'deteriorating':
        status_val = 'needs_attention'
    else:
        status_val = 'ok'

    # Overall trend
    trend = phq_trend if phq_trend != 'stable' else (
        'deteriorating' if negative_count >= 3 else
        'improving' if negative_count == 0 and high_stress == 0 else
        'stable'
    )

    latest_phq = None
    latest_phq_sev = None
    if phq_scores:
        latest_phq = phq_scores[0]
        if latest_phq <= 4: latest_phq_sev = 'Minimal'
        elif latest_phq <= 9: latest_phq_sev = 'Mild'
        elif latest_phq <= 14: latest_phq_sev = 'Moderate'
        elif latest_phq <= 19: latest_phq_sev = 'Moderately Severe'
        else: latest_phq_sev = 'Severe'

    risk_level = 'High' if critical_risk else ('Medium' if status_val == 'needs_attention' else 'Low')

    return {
        'status': status_val,
        'trend': trend,
        'risk_level': risk_level,
        'latest_phq_score': latest_phq,
        'latest_phq_severity': latest_phq_sev,
        'latest_emotion': (history[0].result.get('overall_emotion') or history[0].result.get('emotion', 'Unknown')) if history else None,
        'latest_stress': history[0].result.get('stress_level', 'Unknown') if history else None,
    }


# ─── Stats Overview ──────────────────────────────────────────────────────────
@router.get('/stats', response_model=DoctorStats)
async def get_stats(doctor: User = Depends(doctor_only), db: AsyncSession = Depends(get_db)):
    """Dashboard overview counts."""
    # All patients
    patients = (await db.execute(
        select(User).where(User.role == 'user', User.is_active == True)
    )).scalars().all()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    todays_appts = (await db.execute(
        select(func.count(Appointment.id)).where(
            and_(Appointment.doctor_id == doctor.id,
                 Appointment.scheduled_at >= today_start,
                 Appointment.scheduled_at < today_end,
                 Appointment.status == 'scheduled')
        )
    )).scalar() or 0

    unread = (await db.execute(
        select(func.count(DoctorAlert.id)).where(
            and_(DoctorAlert.doctor_id == doctor.id, DoctorAlert.seen == False)
        )
    )).scalar() or 0

    total_notes = (await db.execute(
        select(func.count(SessionNote.id)).where(SessionNote.doctor_id == doctor.id)
    )).scalar() or 0

    # Compute needs_attention + critical by sampling histories
    needs_attention = 0
    critical = 0
    for p in patients:
        hist = (await db.execute(
            select(AnalysisHistory).where(AnalysisHistory.user_id == p.id)
            .order_by(desc(AnalysisHistory.created_at)).limit(5)
        )).scalars().all()
        s = _compute_patient_status(hist)
        if s['status'] == 'needs_attention': needs_attention += 1
        elif s['status'] == 'critical': critical += 1

    return DoctorStats(
        total_patients=len(patients),
        needs_attention=needs_attention,
        critical=critical,
        todays_appointments=todays_appts,
        unread_alerts=unread,
        total_notes=total_notes,
    )


# ─── Patient List ─────────────────────────────────────────────────────────────
@router.get('/patients', response_model=List[PatientSummary])
async def list_patients(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    doctor: User = Depends(doctor_only),
    db: AsyncSession = Depends(get_db),
):
    """List all patients with summary status."""
    q = select(User).where(User.role == 'user', User.is_active == True)
    if search:
        q = q.where(User.full_name.ilike(f'%{search}%') | User.email.ilike(f'%{search}%'))
    patients = (await db.execute(q.order_by(User.created_at.desc()))).scalars().all()

    result = []
    for p in patients:
        hist = (await db.execute(
            select(AnalysisHistory).where(AnalysisHistory.user_id == p.id)
            .order_by(desc(AnalysisHistory.created_at)).limit(10)
        )).scalars().all()

        status_info = _compute_patient_status(hist)

        unread_alerts = (await db.execute(
            select(func.count(DoctorAlert.id)).where(
                and_(DoctorAlert.doctor_id == doctor.id,
                     DoctorAlert.patient_id == p.id,
                     DoctorAlert.seen == False)
            )
        )).scalar() or 0

        summary = PatientSummary(
            id=p.id,
            full_name=p.full_name,
            email=p.email,
            last_checkin=hist[0].created_at if hist else None,
            total_analyses=len(hist),
            latest_emotion=status_info['latest_emotion'],
            latest_stress=status_info['latest_stress'],
            latest_phq_score=status_info['latest_phq_score'],
            latest_phq_severity=status_info['latest_phq_severity'],
            risk_level=status_info['risk_level'],
            trend=status_info['trend'],
            status=status_info['status'],
            unread_alerts=unread_alerts,
        )
        if status_filter and summary.status != status_filter:
            continue
        result.append(summary)

    return result


# ─── Patient Detail ───────────────────────────────────────────────────────────
@router.get('/patients/{patient_id}', response_model=PatientDetail)
async def get_patient(
    patient_id: int,
    doctor: User = Depends(doctor_only),
    db: AsyncSession = Depends(get_db),
):
    """Full patient profile with history, notes, and appointments."""
    patient = (await db.execute(
        select(User).where(User.id == patient_id, User.role == 'user')
    )).scalar_one_or_none()
    if not patient:
        raise HTTPException(404, 'Patient not found')

    history_rows = (await db.execute(
        select(AnalysisHistory).where(AnalysisHistory.user_id == patient_id)
        .order_by(desc(AnalysisHistory.created_at)).limit(50)
    )).scalars().all()

    notes_rows = (await db.execute(
        select(SessionNote).where(
            and_(SessionNote.patient_id == patient_id, SessionNote.doctor_id == doctor.id)
        ).order_by(desc(SessionNote.created_at))
    )).scalars().all()

    appt_rows = (await db.execute(
        select(Appointment).where(
            and_(Appointment.patient_id == patient_id, Appointment.doctor_id == doctor.id)
        ).order_by(desc(Appointment.scheduled_at))
    )).scalars().all()

    history = [
        PatientHistoryItem(id=r.id, report_type=r.report_type, result=dict(r.result), created_at=r.created_at)
        for r in history_rows
    ]

    notes = [
        {
            'id': n.id, 'content': n.content, 'is_draft': n.is_draft,
            'session_date': n.session_date.isoformat() if n.session_date else None,
            'created_at': n.created_at.isoformat(), 'updated_at': n.updated_at.isoformat()
        }
        for n in notes_rows
    ]

    appointments = [
        {
            'id': a.id, 'scheduled_at': a.scheduled_at.isoformat(),
            'appointment_type': a.appointment_type, 'notes': a.notes,
            'status': a.status, 'created_at': a.created_at.isoformat()
        }
        for a in appt_rows
    ]

    return PatientDetail(
        id=patient.id, full_name=patient.full_name, email=patient.email,
        created_at=patient.created_at, history=history, notes=notes, appointments=appointments,
    )


# ─── AI Pre-Session Brief ──────────────────────────────────────────────────────
@router.get('/patients/{patient_id}/brief', response_model=PreSessionBriefOut)
async def get_presession_brief(
    patient_id: int,
    days: int = 14,
    doctor: User = Depends(doctor_only),
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI pre-session brief based on the last N days of data."""
    patient = (await db.execute(
        select(User).where(User.id == patient_id, User.role == 'user')
    )).scalar_one_or_none()
    if not patient:
        raise HTTPException(404, 'Patient not found')

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    history = (await db.execute(
        select(AnalysisHistory).where(
            and_(AnalysisHistory.user_id == patient_id, AnalysisHistory.created_at >= cutoff)
        ).order_by(desc(AnalysisHistory.created_at))
    )).scalars().all()

    # Also get all-time for comparison
    all_history = (await db.execute(
        select(AnalysisHistory).where(AnalysisHistory.user_id == patient_id)
        .order_by(desc(AnalysisHistory.created_at))
    )).scalars().all()

    important_changes = []
    suggested_topics = []

    if not history:
        return PreSessionBriefOut(
            patient_id=patient_id, patient_name=patient.full_name, period_days=days,
            total_sessions=0, emotion_trend='stable', stress_trend='stable',
            risk_level='Low', important_changes=['No activity in the last {} days'.format(days)],
            suggested_topics=['Check in on patient well-being', 'Review any barriers to engagement'],
            summary=f'{patient.full_name} has no recorded activity in the past {days} days.'
        )

    # Emotion analysis
    emotions = [(r.result.get('overall_emotion') or r.result.get('emotion') or '').lower() for r in history if r.result]
    neg_emotions = {'sad', 'fear', 'anger', 'disgust', 'grief', 'anxious', 'depressed', 'nervousness'}
    neg_count = sum(1 for e in emotions if e in neg_emotions)
    pos_count = sum(1 for e in emotions if e in {'joy', 'happy', 'excitement', 'relief', 'love'})
    emotion_trend = 'deteriorating' if neg_count > pos_count else ('improving' if pos_count > neg_count else 'stable')

    # Stress analysis
    stress_vals = [r.result.get('stress_level', '') for r in history]
    high_stress_count = stress_vals.count('High')
    stress_trend = 'deteriorating' if high_stress_count > len(stress_vals) / 2 else 'stable'

    # PHQ-9 analysis
    phq_records = [r for r in all_history if r.report_type in ('phq9', 'fusion')]
    current_phq = None
    prev_phq = None
    phq9_change = None

    if phq_records:
        cr = phq_records[0].result
        current_phq = cr.get('phq_score') or cr.get('score') or cr.get('total_score')
        if len(phq_records) > 1:
            pr = phq_records[1].result
            prev_phq = pr.get('phq_score') or pr.get('score') or pr.get('total_score')
        if current_phq is not None and prev_phq is not None:
            delta = current_phq - prev_phq
            if delta > 0:
                phq9_change = f'Increased by {delta} points (↑ worsening)'
                important_changes.append(f'PHQ-9 score increased by {delta} points (now {current_phq})')
            elif delta < 0:
                phq9_change = f'Decreased by {abs(delta)} points (↓ improving)'
                important_changes.append(f'PHQ-9 score improved by {abs(delta)} points (now {current_phq})')
            else:
                phq9_change = 'No change from last assessment'

    # Risk assessment
    risk_flags = [str(r.result.get('risk_level', r.result.get('suicide_risk', ''))).lower() for r in history]
    critical_risk = any(x in ('high', 'critical', 'severe') for x in risk_flags)
    risk_level = 'High' if critical_risk else ('Medium' if high_stress_count > 1 else 'Low')

    # Build important changes
    if emotion_trend == 'deteriorating':
        important_changes.append(f'Predominantly negative emotional states detected ({neg_count}/{len(emotions)} sessions)')
    if high_stress_count > 0:
        important_changes.append(f'High stress reported in {high_stress_count} of {len(stress_vals)} recent sessions')
    if critical_risk:
        important_changes.append('⚠️ Critical risk indicators detected — requires immediate clinical review')

    voice_stress = [r for r in history if r.report_type == 'voice' and r.result.get('stress_level') == 'High']
    if voice_stress:
        important_changes.append(f'Voice stress elevated in {len(voice_stress)} recent audio session(s)')

    if not important_changes:
        important_changes.append('Patient appears stable with no significant changes this period')

    # Suggested topics
    if current_phq and current_phq >= 15:
        suggested_topics.append('Review depressive symptoms and PHQ-9 responses in detail')
    if high_stress_count > 1:
        suggested_topics.append('Explore current stressors and coping strategies')
    if neg_count > 2:
        suggested_topics.append('Discuss emotional triggers from recent journal entries')
    if emotion_trend == 'deteriorating':
        suggested_topics.append('Review sleep patterns and daily routine')
    if critical_risk:
        suggested_topics.append('Safety assessment and crisis plan review')

    if not suggested_topics:
        suggested_topics = ['Reflect on progress since last session', 'Review goals and treatment plan']

    # Summary narrative
    trend_word = {'deteriorating': 'declining', 'improving': 'improving', 'stable': 'stable'}
    summary = (
        f"{patient.full_name} has completed {len(history)} check-in(s) in the past {days} days. "
        f"Emotional state appears {trend_word[emotion_trend]}, with "
        f"{'elevated stress detected' if high_stress_count > 0 else 'stress levels appearing manageable'}. "
        f"{'PHQ-9 score is ' + str(current_phq) + '.' if current_phq else ''} "
        f"Overall risk is assessed as {risk_level}."
    ).strip()

    return PreSessionBriefOut(
        patient_id=patient_id, patient_name=patient.full_name, period_days=days,
        total_sessions=len(history), emotion_trend=emotion_trend, stress_trend=stress_trend,
        phq9_change=phq9_change, phq9_current_score=current_phq, phq9_previous_score=prev_phq,
        risk_level=risk_level, important_changes=important_changes,
        suggested_topics=suggested_topics, summary=summary,
    )


# ─── Session Notes ─────────────────────────────────────────────────────────────
@router.get('/notes', response_model=List[SessionNoteOut])
async def list_notes(doctor: User = Depends(doctor_only), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(SessionNote).where(SessionNote.doctor_id == doctor.id)
        .order_by(desc(SessionNote.created_at))
    )).scalars().all()
    return [SessionNoteOut(
        id=n.id, doctor_id=n.doctor_id, patient_id=n.patient_id,
        content=n.content, is_draft=n.is_draft,
        session_date=n.session_date, created_at=n.created_at, updated_at=n.updated_at
    ) for n in rows]


@router.post('/notes', response_model=SessionNoteOut, status_code=201)
async def create_note(
    payload: SessionNoteCreate,
    doctor: User = Depends(doctor_only),
    db: AsyncSession = Depends(get_db),
):
    """Create or save a SOAP session note."""
    patient = (await db.execute(select(User).where(User.id == payload.patient_id, User.role == 'user'))).scalar_one_or_none()
    if not patient:
        raise HTTPException(404, 'Patient not found')

    note = SessionNote(
        doctor_id=doctor.id,
        patient_id=payload.patient_id,
        content={
            'subjective': payload.subjective,
            'objective': payload.objective,
            'assessment': payload.assessment,
            'plan': payload.plan,
        },
        is_draft=payload.is_draft,
        session_date=payload.session_date or datetime.now(timezone.utc),
    )
    db.add(note)
    db.add(AuditLog(user_id=doctor.id, action='create_note', detail=f'patient_id={payload.patient_id}'))
    await db.commit()
    await db.refresh(note)
    return SessionNoteOut(
        id=note.id, doctor_id=note.doctor_id, patient_id=note.patient_id,
        content=note.content, is_draft=note.is_draft,
        session_date=note.session_date, created_at=note.created_at, updated_at=note.updated_at,
    )


@router.put('/notes/{note_id}', response_model=SessionNoteOut)
async def update_note(
    note_id: int,
    payload: SessionNoteCreate,
    doctor: User = Depends(doctor_only),
    db: AsyncSession = Depends(get_db),
):
    note = (await db.execute(
        select(SessionNote).where(and_(SessionNote.id == note_id, SessionNote.doctor_id == doctor.id))
    )).scalar_one_or_none()
    if not note:
        raise HTTPException(404, 'Note not found')

    note.content = {
        'subjective': payload.subjective,
        'objective': payload.objective,
        'assessment': payload.assessment,
        'plan': payload.plan,
    }
    note.is_draft = payload.is_draft
    if payload.session_date:
        note.session_date = payload.session_date

    await db.commit()
    await db.refresh(note)
    return SessionNoteOut(
        id=note.id, doctor_id=note.doctor_id, patient_id=note.patient_id,
        content=note.content, is_draft=note.is_draft,
        session_date=note.session_date, created_at=note.created_at, updated_at=note.updated_at,
    )


# ─── Appointments ──────────────────────────────────────────────────────────────
@router.get('/appointments', response_model=List[AppointmentOut])
async def list_appointments(
    upcoming_only: bool = False,
    doctor: User = Depends(doctor_only),
    db: AsyncSession = Depends(get_db),
):
    q = select(Appointment).where(Appointment.doctor_id == doctor.id)
    if upcoming_only:
        q = q.where(and_(Appointment.scheduled_at >= datetime.now(timezone.utc), Appointment.status == 'scheduled'))
    rows = (await db.execute(q.order_by(Appointment.scheduled_at))).scalars().all()

    result = []
    for a in rows:
        patient = (await db.execute(select(User).where(User.id == a.patient_id))).scalar_one_or_none()
        result.append(AppointmentOut(
            id=a.id, doctor_id=a.doctor_id, patient_id=a.patient_id,
            patient_name=patient.full_name if patient else 'Unknown',
            scheduled_at=a.scheduled_at, appointment_type=a.appointment_type,
            notes=a.notes, status=a.status, created_at=a.created_at,
        ))
    return result


@router.post('/appointments', response_model=AppointmentOut, status_code=201)
async def create_appointment(
    payload: AppointmentCreate,
    doctor: User = Depends(doctor_only),
    db: AsyncSession = Depends(get_db),
):
    patient = (await db.execute(select(User).where(User.id == payload.patient_id, User.role == 'user'))).scalar_one_or_none()
    if not patient:
        raise HTTPException(404, 'Patient not found')

    appt = Appointment(
        doctor_id=doctor.id,
        patient_id=payload.patient_id,
        scheduled_at=payload.scheduled_at,
        appointment_type=payload.appointment_type,
        notes=payload.notes,
        status='scheduled',
    )
    db.add(appt)
    db.add(AuditLog(user_id=doctor.id, action='schedule_appointment', detail=f'patient_id={payload.patient_id}'))
    await db.commit()
    await db.refresh(appt)
    return AppointmentOut(
        id=appt.id, doctor_id=appt.doctor_id, patient_id=appt.patient_id,
        patient_name=patient.full_name, scheduled_at=appt.scheduled_at,
        appointment_type=appt.appointment_type, notes=appt.notes,
        status=appt.status, created_at=appt.created_at,
    )


@router.put('/appointments/{appt_id}', response_model=AppointmentOut)
async def update_appointment(
    appt_id: int,
    payload: AppointmentUpdate,
    doctor: User = Depends(doctor_only),
    db: AsyncSession = Depends(get_db),
):
    valid_statuses = ('scheduled', 'completed', 'missed', 'cancelled')
    if payload.status not in valid_statuses:
        raise HTTPException(400, f'Status must be one of: {", ".join(valid_statuses)}')

    appt = (await db.execute(
        select(Appointment).where(and_(Appointment.id == appt_id, Appointment.doctor_id == doctor.id))
    )).scalar_one_or_none()
    if not appt:
        raise HTTPException(404, 'Appointment not found')

    appt.status = payload.status
    if payload.notes:
        appt.notes = payload.notes
    await db.commit()
    await db.refresh(appt)
    patient = (await db.execute(select(User).where(User.id == appt.patient_id))).scalar_one_or_none()
    return AppointmentOut(
        id=appt.id, doctor_id=appt.doctor_id, patient_id=appt.patient_id,
        patient_name=patient.full_name if patient else 'Unknown',
        scheduled_at=appt.scheduled_at, appointment_type=appt.appointment_type,
        notes=appt.notes, status=appt.status, created_at=appt.created_at,
    )


# ─── Alerts ────────────────────────────────────────────────────────────────────
@router.get('/alerts', response_model=List[AlertOut])
async def list_alerts(
    unread_only: bool = False,
    doctor: User = Depends(doctor_only),
    db: AsyncSession = Depends(get_db),
):
    q = select(DoctorAlert).where(DoctorAlert.doctor_id == doctor.id)
    if unread_only:
        q = q.where(DoctorAlert.seen == False)
    rows = (await db.execute(q.order_by(desc(DoctorAlert.created_at)).limit(50))).scalars().all()
    result = []
    for a in rows:
        patient = (await db.execute(select(User).where(User.id == a.patient_id))).scalar_one_or_none()
        result.append(AlertOut(
            id=a.id, patient_id=a.patient_id,
            patient_name=patient.full_name if patient else 'Unknown',
            alert_type=a.alert_type, message=a.message, severity=a.severity,
            seen=a.seen, analysis_id=a.analysis_id, created_at=a.created_at,
        ))
    return result


@router.post('/alerts/{alert_id}/seen', status_code=204)
async def mark_alert_seen(
    alert_id: int,
    doctor: User = Depends(doctor_only),
    db: AsyncSession = Depends(get_db),
):
    alert = (await db.execute(
        select(DoctorAlert).where(and_(DoctorAlert.id == alert_id, DoctorAlert.doctor_id == doctor.id))
    )).scalar_one_or_none()
    if not alert:
        raise HTTPException(404, 'Alert not found')
    alert.seen = True
    await db.commit()


@router.post('/alerts/mark-all-seen', status_code=204)
async def mark_all_alerts_seen(doctor: User = Depends(doctor_only), db: AsyncSession = Depends(get_db)):
    alerts = (await db.execute(
        select(DoctorAlert).where(and_(DoctorAlert.doctor_id == doctor.id, DoctorAlert.seen == False))
    )).scalars().all()
    for a in alerts:
        a.seen = True
    await db.commit()


# ─── Doctor Copilot ────────────────────────────────────────────────────────────
@router.post('/copilot', response_model=CopilotResponse)
async def copilot(
    payload: CopilotQuery,
    doctor: User = Depends(doctor_only),
    db: AsyncSession = Depends(get_db),
):
    """
    Rule-based AI copilot answering patient-specific clinical questions.
    Uses only stored patient data — no external LLM calls.
    """
    patient = (await db.execute(
        select(User).where(User.id == payload.patient_id, User.role == 'user')
    )).scalar_one_or_none()
    if not patient:
        raise HTTPException(404, 'Patient not found')

    history = (await db.execute(
        select(AnalysisHistory).where(AnalysisHistory.user_id == payload.patient_id)
        .order_by(desc(AnalysisHistory.created_at)).limit(30)
    )).scalars().all()

    q = payload.question.lower()
    data_points = []
    answer = ''

    # What changed since last session?
    if any(kw in q for kw in ['changed', 'change', 'different', 'last session', 'since']):
        if len(history) >= 2:
            latest = history[0].result
            prev = history[1].result
            changes = []
            for field in ['overall_emotion', 'emotion', 'stress_level']:
                v1 = latest.get(field)
                v2 = prev.get(field)
                if v1 and v2 and v1 != v2:
                    changes.append(f'{field.replace("_", " ").title()}: {v2} → {v1}')
            phq_now = latest.get('phq_score') or latest.get('score')
            phq_then = prev.get('phq_score') or prev.get('score')
            if phq_now and phq_then and phq_now != phq_then:
                changes.append(f'PHQ-9 score: {phq_then} → {phq_now} ({"↑" if phq_now > phq_then else "↓"})')
            answer = f'Since the last session, the following changes were detected for {patient.full_name}: ' + (
                '; '.join(changes) if changes else 'No significant metric changes detected.'
            )
            data_points = [{'latest': latest, 'previous': prev}]
        else:
            answer = f'Insufficient history to compare sessions for {patient.full_name}.'

    # PHQ-9 history
    elif any(kw in q for kw in ['phq', 'depression', 'score', 'assessment']):
        phq_rows = [r for r in history if r.report_type in ('phq9', 'fusion')][:5]
        if phq_rows:
            scores = [(r.created_at.strftime('%Y-%m-%d'), r.result.get('phq_score') or r.result.get('score', 'N/A')) for r in phq_rows]
            answer = f'PHQ-9 history for {patient.full_name} (last {len(scores)} assessments): ' + \
                     ', '.join(f'{d}: {s}' for d, s in scores)
            data_points = [{'date': d, 'phq_score': s} for d, s in scores]
        else:
            answer = f'{patient.full_name} has not completed any PHQ-9 assessments yet.'

    # Today's / session summary
    elif any(kw in q for kw in ['today', "today's", 'summary', 'prepare', 'brief']):
        status_info = _compute_patient_status(history)
        answer = (
            f"Session summary for {patient.full_name}: "
            f"Emotional state is {status_info['latest_emotion'] or 'unknown'}, "
            f"stress is {status_info['latest_stress'] or 'unknown'}, "
            f"PHQ-9 score is {status_info['latest_phq_score'] or 'not available'} "
            f"({status_info['latest_phq_severity'] or 'N/A'}). "
            f"Overall status: {status_info['status'].replace('_', ' ')}. "
            f"Trend: {status_info['trend']}. Risk: {status_info['risk_level']}."
        )
        data_points = [status_info]

    # Stress
    elif any(kw in q for kw in ['stress', 'anxiety']):
        stress_vals = [(r.created_at.strftime('%Y-%m-%d'), r.result.get('stress_level', 'N/A')) for r in history[:7] if r.result]
        high_count = sum(1 for _, v in stress_vals if v == 'High')
        answer = (
            f'Stress overview for {patient.full_name}: '
            f'{high_count} of last {len(stress_vals)} sessions showed High stress. '
            f'Recent readings: {", ".join(f"{d}: {v}" for d, v in stress_vals[:5])}'
        )
        data_points = [{'date': d, 'stress': v} for d, v in stress_vals]

    # Last N assessments
    elif any(kw in q for kw in ['last', 'recent', 'session']):
        n = 3
        for word in q.split():
            if word.isdigit(): n = min(int(word), 10); break
        rows = history[:n]
        answer = f'Last {len(rows)} analyses for {patient.full_name}: ' + '; '.join(
            f'[{r.report_type.upper()} on {r.created_at.strftime("%Y-%m-%d")}]: '
            f'emotion={r.result.get("overall_emotion") or r.result.get("emotion", "N/A")}, '
            f'stress={r.result.get("stress_level", "N/A")}'
            for r in rows
        )
        data_points = [{'id': r.id, 'type': r.report_type, 'date': r.created_at.isoformat()} for r in rows]

    # Default
    else:
        status_info = _compute_patient_status(history)
        answer = (
            f"Here's what I know about {patient.full_name}: "
            f"They have completed {len(history)} total analyses. "
            f"Current emotional state: {status_info['latest_emotion'] or 'N/A'}. "
            f"Stress: {status_info['latest_stress'] or 'N/A'}. "
            f"PHQ-9: {status_info['latest_phq_score'] or 'not available'}. "
            f"Risk level: {status_info['risk_level']}. "
            f"Try asking: 'What changed since last session?', 'Show PHQ-9 history', or 'Prepare today\\'s summary'."
        )
        data_points = [status_info]

    return CopilotResponse(answer=answer, data_points=data_points, confidence='high' if history else 'low')
