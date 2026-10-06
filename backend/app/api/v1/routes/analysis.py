"""Authenticated, validated analysis endpoints for all NeuroAI agents.
When a patient submits any analysis, all doctors receive a DoctorAlert notification.
"""
import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import current_user
from app.core.config import settings
from app.database.models import (
    AnalysisHistory, DoctorAlert, EmotionReport, PHQReport, User, VoiceReport
)
from app.database.session import get_db
from app.fusion.fusion_engine import fusion_engine
from app.recommendations.recommendation_service import recommendations
from app.schemas.contracts import FusionRequest, PHQ9Request, TextRequest
from app.services.phq_service import calculate_phq9
from app.services.text_service import analyze_suicide_risk, analyze_text
from app.services.voice_service import analyze_voice
from app.utils.logging import Timer, log_event

router = APIRouter(tags=['Analysis'])


async def _broadcast_alert(db: AsyncSession, patient: User, analysis: AnalysisHistory, analysis_type: str, result: dict):
    """Create DoctorAlert for all doctors when a patient submits an analysis."""
    doctors = (await db.execute(select(User).where(User.role == 'doctor', User.is_active == True))).scalars().all()
    emotion = result.get('overall_emotion') or result.get('emotion', 'Unknown')
    stress = result.get('stress_level', '')
    phq_score = result.get('total_score') or result.get('phq_score') or result.get('score')

    # Determine severity
    risk_raw = str(result.get('risk_level', result.get('suicide_risk', ''))).lower()
    severity = 'info'
    alert_type = f'new_{analysis_type}'
    msg_parts = [f'{patient.full_name} submitted a new {analysis_type.upper()} check-in.']

    if analysis_type in ('text', 'fusion', 'voice'):
        msg_parts.append(f'Emotion: {emotion}.')
    if stress == 'High':
        msg_parts.append('⚠️ High stress detected.')
        severity = 'warning'
    if risk_raw in ('high', 'critical', 'severe'):
        msg_parts.append('🔴 HIGH RISK indicator detected — review immediately.')
        severity = 'critical'
        alert_type = 'high_risk'
    if phq_score is not None:
        msg_parts.append(f'PHQ-9 score: {phq_score}.')
        if phq_score >= 15:
            severity = 'warning' if severity == 'info' else severity
            alert_type = 'phq9_submitted'

    message = ' '.join(msg_parts)

    for doctor in doctors:
        db.add(DoctorAlert(
            doctor_id=doctor.id,
            patient_id=patient.id,
            alert_type=alert_type,
            message=message,
            severity=severity,
            analysis_id=analysis.id,
        ))


@router.post('/text/analyze', summary='Analyze text emotion and safety risk')
async def text_analysis(payload: TextRequest, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Run the two read-only text models and persist their normalized result."""
    timer = Timer()
    result = await run_in_threadpool(analyze_text, payload.text)
    result['suicide_risk'] = await run_in_threadpool(analyze_suicide_risk, payload.text)
    db.add(EmotionReport(user_id=user.id, emotion=result['emotion'], confidence=result['confidence'], result=result))
    history = AnalysisHistory(user_id=user.id, report_type='text', result=result)
    db.add(history)
    await db.flush()
    await _broadcast_alert(db, user, history, 'text', result)
    await db.commit()
    log_event('text_inference', user_id=user.id, emotion=result['emotion'], duration_ms=timer.milliseconds)
    return result


@router.post('/voice/analyze', summary='Analyze an uploaded WAV, MP3, M4A, WebM, or OGG recording')
async def voice_analysis(audio: UploadFile = File(..., description='Audio recording: WAV, MP3, M4A, WebM, or OGG'), user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Validate audio upload, run voice inference off the event loop, and delete temporary data."""
    suffix = Path(audio.filename or '').suffix.lower()
    if suffix not in {'.wav', '.mp3', '.m4a', '.webm', '.ogg'}:
        raise HTTPException(415, 'Only WAV, MP3, M4A, WebM, and OGG audio files are accepted')
    content = await audio.read()
    if not content: raise HTTPException(400, 'Audio file is empty')
    if len(content) > settings.max_upload_bytes: raise HTTPException(413, 'Audio file exceeds the configured size limit')
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(content); path = Path(f.name)
    timer = Timer()
    try:
        result = await run_in_threadpool(analyze_voice, path)
    finally:
        path.unlink(missing_ok=True)
    db.add(VoiceReport(user_id=user.id, emotion=result['emotion'], confidence=result['confidence'], result=result))
    history = AnalysisHistory(user_id=user.id, report_type='voice', result=result)
    db.add(history)
    await db.flush()
    await _broadcast_alert(db, user, history, 'voice', result)
    await db.commit()
    log_event('voice_inference', user_id=user.id, emotion=result['emotion'], duration_ms=timer.milliseconds)
    return result


@router.post('/phq9/analyze', summary='Calculate PHQ-9 score and severity')
@router.post('/phq9', include_in_schema=False)
async def phq9(payload: PHQ9Request, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Calculate a deterministic PHQ-9 assessment; no machine-learning model is used."""
    result = calculate_phq9(payload.answers)
    db.add(PHQReport(user_id=user.id, score=result['total_score'], severity=result['severity'], answers=result['answers']))
    history = AnalysisHistory(user_id=user.id, report_type='phq9', result=result)
    db.add(history)
    await db.flush()
    await _broadcast_alert(db, user, history, 'phq9', result)
    await db.commit()
    log_event('phq9_calculated', user_id=user.id, score=result['total_score'], severity=result['severity'])
    return result


@router.post('/fusion/analyze', summary='Generate a multi-agent mental wellness report')
async def fusion_analysis(payload: FusionRequest, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Fuse text, safety, optional voice, and PHQ-9 agent outputs into an explainable report."""
    timer = Timer()
    text = await run_in_threadpool(analyze_text, payload.text)
    risk = await run_in_threadpool(analyze_suicide_risk, payload.text)
    voice = {'emotion': payload.voice_emotion, 'confidence': payload.voice_confidence * 100} if payload.voice_emotion and payload.voice_confidence is not None else None
    report = fusion_engine.analyze(text, risk, payload.phq_answers, voice)
    report['recommendations'] = recommendations(report)
    report['user'] = user.full_name
    history = AnalysisHistory(user_id=user.id, report_type='fusion', result=report)
    db.add(history)
    await db.flush()
    await _broadcast_alert(db, user, history, 'fusion', report)
    await db.commit()
    log_event('fusion_completed', user_id=user.id, emotion=report['overall_emotion'], risk=report['suicide_risk'], duration_ms=timer.milliseconds)
    return report
