import sqlite3

from business import (
    init_db,
    create_assessment,
    generate_diagnosis,
    create_content_plan,
    record_feedback,
    create_weekly_review,
    dashboard_metrics,
)


def memory_conn():
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    init_db(conn)
    return conn


def test_light_assessment_allows_no_company_before_value_is_shown():
    conn = memory_conn()
    assessment_id = create_assessment(conn, {
        'industry': '本地服务',
        'main_goal': '获得更多咨询',
        'current_channels': '视频号, 小红书',
        'posting_frequency': '偶尔发布',
        'biggest_problem': '不知道发什么',
        'target_customer': '附近3公里宝妈',
        'offer': '到店体验课',
    })

    row = conn.execute('SELECT * FROM assessments WHERE id=?', (assessment_id,)).fetchone()

    assert row['company_name'] == '未命名客户'
    assert row['target_customer'] == '附近3公里宝妈'
    assert row['offer'] == '到店体验课'


def test_diagnosis_contains_score_stage_and_next_step_for_new_mvp():
    conn = memory_conn()
    assessment_id = create_assessment(conn, {
        'industry': '工业设备',
        'main_goal': '获得更多咨询',
        'current_channels': '视频号',
        'posting_frequency': '每周1条',
        'biggest_problem': '没咨询',
        'target_customer': '工厂采购负责人',
        'offer': '免费方案评估',
    })

    diagnosis = generate_diagnosis(conn, assessment_id)

    assert 0 <= diagnosis['score'] <= 100
    assert diagnosis['priority_problem'] == '内容不转化'
    assert diagnosis['next_step'] == '把内容结尾改成「免费方案评估」相关 CTA，并追踪是否真的带来「获得更多咨询」。'


def test_content_plan_uses_target_customer_and_offer():
    conn = memory_conn()
    assessment_id = create_assessment(conn, {
        'industry': '工业设备',
        'main_goal': '获得更多咨询',
        'current_channels': '视频号',
        'posting_frequency': '每周1条',
        'biggest_problem': '不知道发什么',
        'target_customer': '设备采购负责人',
        'offer': '免费选型建议',
    })
    diagnosis = generate_diagnosis(conn, assessment_id)

    items = create_content_plan(conn, diagnosis['id'])

    assert len(items) == 7
    assert any('设备采购负责人' in item['topic'] for item in items)
    assert any('免费选型建议' in item['cta'] for item in items)


def test_oral_clinic_plan_uses_current_form_fields_without_old_mock():
    conn = memory_conn()
    assessment_id = create_assessment(conn, {
        'industry': '口腔门诊',
        'main_goal': '让更多家长预约儿童牙齿矫正咨询',
        'current_channels': '朋友圈、小红书、美团',
        'posting_frequency': '每周3条',
        'biggest_problem': '不知道发什么',
        'target_customer': '25-45岁本地宝妈和家庭客户',
        'offer': '儿童牙齿矫正、种植牙、口腔检查',
        'customer_pain': '怕贵、怕没效果、不信任医生专业度',
    })
    diagnosis = generate_diagnosis(conn, assessment_id)
    items = create_content_plan(conn, diagnosis['id'])
    combined = '\n'.join([
        diagnosis['insight'],
        diagnosis['weekly_action'],
        diagnosis['next_step'],
        *[item['platform'] + item['topic'] + item['angle'] + item['cta'] for item in items],
    ])

    assert '口腔门诊' in combined
    assert '宝妈' in combined
    assert '儿童牙齿矫正' in combined
    assert '种植牙' in combined
    assert '口腔检查' in combined
    assert '怕贵' in combined
    assert '医生专业度' in combined
    assert [item['platform'] for item in items[:6]] == ['朋友圈', '小红书', '美团', '朋友圈', '小红书', '美团']
    assert '视频号' not in [item['platform'] for item in items]
    assert '本地服务' not in combined
    assert '有明确需求的本地客户' not in combined
    assert '一次免费咨询' not in combined
    assert '工厂采购负责人' not in combined
    assert '工业设备' not in combined
    assert '免费选型建议' not in combined


def test_weekly_review_turns_feedback_into_next_round_suggestion():
    conn = memory_conn()
    assessment_id = create_assessment(conn, {
        'industry': '本地服务',
        'main_goal': '获得更多咨询',
        'current_channels': '小红书',
        'posting_frequency': '偶尔发布',
        'biggest_problem': '没咨询',
        'target_customer': '宝妈',
        'offer': '体验课',
    })
    diagnosis = generate_diagnosis(conn, assessment_id)
    plans = create_content_plan(conn, diagnosis['id'])
    record_feedback(conn, plans[0]['id'], {'views': 1800, 'likes': 40, 'comments': 6, 'favorites': 20, 'shares': 4, 'consultations': 5})
    record_feedback(conn, plans[1]['id'], {'views': 600, 'likes': 5, 'comments': 1, 'favorites': 2, 'shares': 0, 'consultations': 0})

    review = create_weekly_review(conn)
    metrics = dashboard_metrics(conn)

    assert review['winner_topic'] == plans[0]['topic']
    assert '加码' in review['next_actions']
    assert metrics['feedback_rate'] == 2 / 7
