"""Authenticated report history for the patient dashboard and reports page."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import current_user
from app.database.models import AnalysisHistory, User
from app.database.session import get_db

router = APIRouter(prefix='/reports', tags=['Reports'])

# Emotion is stored under different keys per analysis type; text analyses keep
# the full safety payload which the history view only needs summarised.
_EMOTION_KEYS = ('overall_emotion', 'emotion')


def _summarize(result: dict, report_type: str) -> dict:
    """Flatten a stored result into the scalar fields the dashboards render.

    Every accessor downstream reads fixed keys, so they are filled here once
    rather than being re-derived (and possibly mis-derived) in each component.
    """
    out = dict(result or {})

    if isinstance(out.get('suicide_risk'), dict):
        out['suicide_risk'] = out['suicide_risk'].get('risk_level', 'Not assessed')

    emotion = next((out[k] for k in _EMOTION_KEYS if out.get(k)), None)
    out['emotion'] = emotion or 'Unknown'

    confidence = out.get('overall_confidence')
    if confidence is None:
        confidence = out.get('confidence')
    out['confidence'] = round(float(confidence), 2) if isinstance(confidence, (int, float)) else None

    if report_type == 'phq9':
        out['phq_score'] = out.get('total_score', out.get('score'))
        out['label'] = out.get('severity') or 'Not assessed'
    else:
        out['label'] = emotion or 'Unknown'
    return out


@router.get('/history')
async def history(limit: int = 50, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(AnalysisHistory)
        .where(AnalysisHistory.user_id == user.id)
        .order_by(AnalysisHistory.created_at.desc())
        .limit(min(max(limit, 1), 100))
    )).scalars().all()

    payload = []
    for row in rows:
        result = _summarize(row.result, row.report_type)
        payload.append({
            'id': row.id,
            'report_type': row.report_type,
            'type': row.report_type,
            'result': result,
            'created_at': row.created_at,
        })
    return payload
