"""Text emotion and safety inference over the two read-only transformer models."""
from time import perf_counter

from fastapi import HTTPException

from app.services.model_manager import model_manager


def _require(condition: bool, message: str):
    if not condition:
        raise HTTPException(status_code=503, detail=message)


def analyze_text(text: str) -> dict:
    """Top GoEmotions labels for free text.

    Waits for the background startup load so a request that arrives in the
    first seconds does not fail against a not-yet-loaded tokenizer.
    """
    started = perf_counter()
    model_manager.ensure_loaded()
    _require(model_manager.text_models_ready(),
             'Text emotion model is still loading. Please retry in a few seconds.')
    ranked = model_manager.classify_text(
        text, model_manager.go_model, model_manager.go_tokenizer, model_manager.go_labels
    )
    top = [{'emotion': label, 'confidence': round(score * 100, 2)} for label, score in ranked[:5]]
    return {
        'emotion': top[0]['emotion'],
        'confidence': top[0]['confidence'],
        'top_emotions': top,
        'processing_time_ms': round((perf_counter() - started) * 1000, 2),
    }


def analyze_suicide_risk(text: str) -> dict:
    """Self-harm language risk; deliberately reported only as High or Low."""
    model_manager.ensure_loaded()
    _require(model_manager.suicide_models_ready(),
             'Safety classifier is still loading. Please retry in a few seconds.')
    ranked = model_manager.classify_text(
        text, model_manager.suicide_model, model_manager.suicide_tokenizer, model_manager.suicide_labels
    )
    label, confidence = ranked[0]
    risk = 'High' if label.lower() in {'suicide', 'suicidal', '1'} else 'Low'
    return {
        'risk_level': risk,
        'confidence': round(confidence * 100, 2),
        'explanation': 'The safety classifier detected elevated language risk.' if risk == 'High'
        else 'No elevated self-harm language signal was detected.',
    }
