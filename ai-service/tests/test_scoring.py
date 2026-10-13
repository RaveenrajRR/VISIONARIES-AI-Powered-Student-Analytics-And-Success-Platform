from datetime import datetime, timezone

import pytest

from app.scoring.engine import (
    analyze_risk,
    calculate_score,
    placement_readiness,
    recommend,
    segment,
)
def test_score_is_bounded_and_coverage_reported():
 r=calculate_score({'semester_gpa':8,'backlogs':0,'attendance_pct':90}); assert 0<=r['score']<=100; assert r['coverage_pct']==50
def test_backlogs_reduce_academic_component():
 a=calculate_score({'semester_gpa':8,'backlogs':0}); b=calculate_score({'semester_gpa':8,'backlogs':2}); assert a['score']>b['score']
def test_missing_values_not_fabricated():
 r=calculate_score({}); assert r['score'] is None and r['coverage_pct']==0
def test_risk_reasons_and_recommendations():
 m={'attendance_pct':60,'semester_gpa':5.2,'backlogs':2,'aptitude_pct':40}; r=analyze_risk(m); assert r['academic_risk'] and r['placement_risk']; assert recommend(m)

def test_negative_engagement_is_clamped():
 result=calculate_score({'club_activities':-4})
 assert result['components']['engagement']==0

def test_freshness_and_confidence_are_distinct_from_coverage():
 now=datetime(2026,1,1,tzinfo=timezone.utc)
 result=calculate_score(
     {'semester_gpa':8,'attendance_pct':90},
     {'academic':'2025-12-01T00:00:00+00:00','attendance':'2025-01-01T00:00:00+00:00'},
     now,
 )
 assert result['coverage_pct']==50
 assert result['freshness_pct']==60
 assert result['confidence_pct']==30
 assert result['source_freshness']['attendance']['status']=='stale'

def test_small_clock_skew_does_not_mark_a_source_stale():
 now=datetime(2026,1,1,tzinfo=timezone.utc)
 result=calculate_score(
     {'attendance_pct':90},
     {'attendance':'2026-01-01T03:00:00+00:00'},
     now,
 )
 assert result['freshness_pct']==100
 assert result['confidence_pct']==20

def test_risk_considers_falling_trend_and_recommendations_have_measurable_outcomes():
 metrics={'semester_gpa':6.5,'trend':-1.2,'coding_pct':40}
 risk=analyze_risk(metrics)
 assert any(reason['metric']=='trend' for reason in risk['academic_reasons'])
 recommendations=recommend(metrics,calculate_score(metrics))
 assert all(item['expected_outcome'] and item['suggested_action'] for item in recommendations)

def test_placement_readiness_uses_only_observed_fields():
 result=placement_readiness({'coding_pct':40,'communication_pct':80})
 assert result['readiness_pct']==60
 assert result['coverage_pct']==33.3
 assert [gap['skill'] for gap in result['skill_gaps']]==['Coding']

def test_segments_return_evidence_and_action():
 metrics={'semester_gpa':8.5,'aptitude_pct':40,'coding_pct':50,'mock_interview_pct':55,'attendance_pct':90}
 result=calculate_score(metrics)
 classified=segment(metrics,result)
 assert classified['name']=='High academic performance, low placement readiness'
 assert classified['evidence']
 assert classified['recommended_action']
