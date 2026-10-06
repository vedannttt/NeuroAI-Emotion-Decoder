def calculate_phq9(answers:list[int])->dict:
    score=sum(answers)
    severity='Minimal' if score<=4 else 'Mild' if score<=9 else 'Moderate' if score<=14 else 'Moderately Severe' if score<=19 else 'Severe'
    return {'total_score':score,'severity':severity,'answers':answers}
