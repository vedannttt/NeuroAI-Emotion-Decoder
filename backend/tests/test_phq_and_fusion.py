from app.fusion.fusion_engine import fuse
from app.services.phq_service import calculate_phq9
def test_phq_severity_boundaries():
    assert calculate_phq9([0]*9)['severity']=='Minimal'
    assert calculate_phq9([1]*5+[0]*4)['severity']=='Mild'
    assert calculate_phq9([3]*9)['severity']=='Severe'
def test_fusion_has_fixed_explanations():
    report=fuse({'emotion':'sadness','confidence':90},{'emotion':'calm','confidence':80},[1]*9,{'risk_level':'Low','confidence':95})
    assert report['fusion_weights']=={'text':35,'voice':35,'phq9':20,'suicide':10}
    assert len(report['explainability']['contributions'])==4
    assert report['stress_level']=='Medium'
