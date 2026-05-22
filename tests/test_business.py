import sqlite3

from business import (
    init_db,
    seed_demo_data,
    create_assessment,
    generate_diagnosis,
    create_content_plan,
    record_feedback,
    dashboard_metrics,
)


def memory_conn():
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    init_db(conn)
    return conn


def test_assessment_generates_stage_score_and_priority_problem():
    conn = memory_conn()
    assessment_id = create_assessment(conn, {
        'company_name': '南京样板制造有限公司',
        'industry': '工业设备',
        'main_goal': '获得更多咨询',
        'current_channels': '视频号, 小红书',
        'posting_frequency': '偶尔发布',
        'biggest_problem': '不知道发什么',
        'target_customer': '工厂采购负责人',
        'offer': '免费选型建议',
        'best_recent_content': '客户案例短视频',
        'contact': '赵娜'
    })

    diagnosis = generate_diagnosis(conn, assessment_id)

    assert diagnosis['stage'] == '起步诊断期'
    assert diagnosis['priority_problem'] == '选题不稳定'
    assert diagnosis['score'] > 50
    assert '视频号, 小红书' in diagnosis['weekly_action']
    assert '工厂采购负责人' in diagnosis['weekly_action']
    assert '获得更多咨询' in diagnosis['weekly_action']


def test_content_plan_creates_seven_actionable_items_from_diagnosis():
    conn = memory_conn()
    assessment_id = create_assessment(conn, {
        'company_name': '南京样板制造有限公司',
        'industry': '工业设备',
        'main_goal': '获得更多咨询',
        'current_channels': '视频号',
        'posting_frequency': '每周1条',
        'biggest_problem': '没咨询',
        'target_customer': '工厂老板',
        'offer': '免费方案评估',
        'best_recent_content': '售后案例',
        'contact': '赵娜'
    })
    diagnosis = generate_diagnosis(conn, assessment_id)

    items = create_content_plan(conn, diagnosis['id'])

    assert len(items) == 7
    assert items[0]['platform'] == '视频号'
    assert all(item['status'] == '待发布' for item in items)
    assert any('痛点' in item['angle'] for item in items)
    assert any('免费方案评估' in item['cta'] for item in items)


def test_feedback_updates_dashboard_metrics_and_next_suggestion():
    conn = memory_conn()
    seed_demo_data(conn)
    first_plan = conn.execute('SELECT id FROM content_plans ORDER BY id LIMIT 1').fetchone()['id']

    record_feedback(conn, first_plan, {
        'views': 1200,
        'likes': 36,
        'comments': 8,
        'favorites': 12,
        'shares': 5,
        'consultations': 4,
        'notes': '有客户问价格'
    })
    metrics = dashboard_metrics(conn)

    assert metrics['total_plans'] == 7
    assert metrics['published_plans'] == 1
    assert metrics['feedback_rate'] == 1 / 7
    assert metrics['total_consultations'] == 4
    assert metrics['next_suggestion'] == '加码：已有内容带来咨询，下周复制最高咨询主题并保留CTA。'
