"""Modular weighted multi-agent decision layer for NeuroAI reports."""
from dataclasses import dataclass
from app.services.phq_service import calculate_phq9

@dataclass(frozen=True)
class FusionWeights:
    text: float = .35
    voice: float = .35
    phq9: float = .20
    suicide: float = .10

class FusionEngine:
    """Combines independent agent outputs without modifying their raw predictions.

    Weights are renormalised across the agents that actually contributed, so a
    report without a voice signal is not penalised for the missing 35%.
    """
    def __init__(self, weights: FusionWeights = FusionWeights()): self.weights = weights

    def analyze(self, text: dict, risk: dict, phq_answers: list[int], voice: dict | None = None) -> dict:
        phq = calculate_phq9(phq_answers)
        has_voice = bool(voice and voice.get('emotion') and voice.get('emotion') != 'Unavailable')
        voice = voice if has_voice else {'emotion': 'Unavailable', 'confidence': 0.0}

        active = [(self.weights.text, text['confidence']), (self.weights.phq9, 100.0), (self.weights.suicide, risk['confidence'])]
        if has_voice:
            active.append((self.weights.voice, voice['confidence']))
        total_weight = sum(w for w, _ in active)
        confidence = sum(w * c for w, c in active) / total_weight if total_weight else 0.0

        stress = 'High' if risk['risk_level'] == 'High' or phq['total_score'] >= 15 else 'Medium' if phq['total_score'] >= 5 else 'Low'
        dominant = voice['emotion'] if has_voice and voice['confidence'] > text['confidence'] else text['emotion']
        contributions = [
            {'agent':'text_emotion','weight_percent':35,'confidence':text['confidence'],'reason':f"Text model identified {text['emotion']}."},
            {'agent':'voice_emotion','weight_percent':35 if has_voice else 0,'confidence':voice['confidence'],'reason':f"Voice model identified {voice['emotion']}." if has_voice else 'No voice signal was provided; this agent did not contribute to the fused score.'},
            {'agent':'phq9','weight_percent':20,'confidence':100.0,'reason':f"PHQ-9 score {phq['total_score']} indicates {phq['severity']} severity."},
            {'agent':'suicide_detection','weight_percent':10,'confidence':risk['confidence'],'reason':f"Safety classifier reported {risk['risk_level']} risk."},
        ]
        return {'overall_emotion':dominant,'stress_level':stress,'overall_confidence':round(confidence,2),'text_emotion':text['emotion'],'voice_emotion':voice['emotion'],'suicide_risk':risk['risk_level'],'phq_severity':phq['severity'],'phq9':phq,'agent_confidences':{'text':text['confidence'],'voice':voice['confidence'],'suicide':risk['confidence'],'phq9':100.0},'fusion_weights':{'text':35,'voice':35 if has_voice else 0,'phq9':20,'suicide':10},'explainability':{'strategy':'Weighted confidence consensus across the agents that produced a signal, with safety and PHQ severity overrides for stress level.','contributions':contributions}}
fusion_engine = FusionEngine()

def fuse(text: dict, voice: dict | None, phq_answers: list[int], risk: dict) -> dict:
    """Backward-compatible convenience wrapper for the default fusion engine."""
    return fusion_engine.analyze(text, risk, phq_answers, voice)
