"""Rule-based, safety-aware recommendation service."""
def recommendations(report: dict) -> list[dict]:
    """Return structured, non-diagnostic wellness guidance for a fusion report."""
    items=[]; emotion=report['overall_emotion'].lower(); voice=report['voice_emotion'].lower()
    if report['suicide_risk']=='High': items.append({'priority':'urgent','category':'safety','title':'Seek immediate support','message':'If you may act on thoughts of self-harm, contact local emergency services or a crisis helpline now. Reach out to someone you trust and avoid being alone.'})
    if report['phq_severity'] in {'Moderately Severe','Severe'}: items.append({'priority':'high','category':'professional_support','title':'Consider professional support','message':'This screening is not a diagnosis. A qualified mental-health professional can help you explore these symptoms.'})
    if report['stress_level']=='High': items.append({'priority':'high','category':'stress','title':'Reset your nervous system','message':'Try a five-minute slow-breathing exercise, then reduce one nonessential demand today.'})
    if emotion in {'sadness','grief','disappointment','remorse'} or voice in {'sad','fearful'}: items.append({'priority':'medium','category':'connection','title':'Name and share the feeling','message':'Consider a brief check-in with a trusted friend, family member, or counsellor.'})
    if emotion in {'joy','optimism','gratitude','love'}: items.append({'priority':'low','category':'wellbeing','title':'Reinforce what helps','message':'Notice what supported this positive state and make room for it again this week.'})
    return items or [{'priority':'low','category':'mindfulness','title':'Continue checking in','message':'Take a short mindful pause and notice your current needs without judgement.'}]
