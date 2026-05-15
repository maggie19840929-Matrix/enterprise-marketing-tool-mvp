import sqlite3
from datetime import date, timedelta


SCHEMA = """
CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL DEFAULT '未命名客户',
    industry TEXT NOT NULL,
    main_goal TEXT NOT NULL,
    current_channels TEXT NOT NULL,
    posting_frequency TEXT NOT NULL,
    biggest_problem TEXT NOT NULL,
    target_customer TEXT DEFAULT '',
    offer TEXT DEFAULT '',
    customer_pain TEXT DEFAULT '',
    content_assets TEXT DEFAULT '',
    monthly_budget TEXT DEFAULT '',
    decision_cycle TEXT DEFAULT '',
    best_recent_content TEXT DEFAULT '',
    contact TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS diagnoses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    stage TEXT NOT NULL,
    priority_problem TEXT NOT NULL,
    insight TEXT NOT NULL,
    weekly_action TEXT NOT NULL,
    next_step TEXT DEFAULT '',
    risk_warning TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id)
);

CREATE TABLE IF NOT EXISTS content_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diagnosis_id INTEGER NOT NULL,
    planned_date TEXT NOT NULL,
    platform TEXT NOT NULL,
    topic TEXT NOT NULL,
    angle TEXT NOT NULL,
    content_type TEXT DEFAULT '短视频/图文',
    cta TEXT DEFAULT '',
    target_metric TEXT NOT NULL,
    owner TEXT NOT NULL DEFAULT '客户负责人',
    status TEXT NOT NULL DEFAULT '待发布',
    publish_link TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (diagnosis_id) REFERENCES diagnoses(id)
);

CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_plan_id INTEGER NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    favorites INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0,
    consultations INTEGER NOT NULL DEFAULT 0,
    publish_link TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_plan_id) REFERENCES content_plans(id)
);

CREATE TABLE IF NOT EXISTS weekly_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    total_posts INTEGER NOT NULL DEFAULT 0,
    total_views INTEGER NOT NULL DEFAULT 0,
    total_interactions INTEGER NOT NULL DEFAULT 0,
    total_consultations INTEGER NOT NULL DEFAULT 0,
    winner_topic TEXT DEFAULT '',
    bottleneck TEXT DEFAULT '',
    next_actions TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""

MIGRATIONS = {
    'assessments': {
        'target_customer': "TEXT DEFAULT ''",
        'offer': "TEXT DEFAULT ''",
        'customer_pain': "TEXT DEFAULT ''",
        'content_assets': "TEXT DEFAULT ''",
        'monthly_budget': "TEXT DEFAULT ''",
        'decision_cycle': "TEXT DEFAULT ''",
    },
    'diagnoses': {
        'score': 'INTEGER NOT NULL DEFAULT 0',
        'next_step': "TEXT DEFAULT ''",
        'risk_warning': "TEXT DEFAULT ''",
    },
    'content_plans': {
        'content_type': "TEXT DEFAULT '短视频/图文'",
        'cta': "TEXT DEFAULT ''",
    },
    'feedback': {
        'publish_link': "TEXT DEFAULT ''",
    },
}


def connect(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    init_db(conn)
    return conn


def init_db(conn):
    conn.executescript(SCHEMA)
    for table, columns in MIGRATIONS.items():
        existing = {r['name'] for r in conn.execute(f'PRAGMA table_info({table})').fetchall()}
        for name, ddl in columns.items():
            if name not in existing:
                conn.execute(f'ALTER TABLE {table} ADD COLUMN {name} {ddl}')
    conn.commit()


def dict_row(row):
    return dict(row) if row else None


def _clean(data, key, default=''):
    return str(data.get(key, default) or '').strip()


def create_assessment(conn, data):
    required = ['industry', 'main_goal', 'current_channels', 'posting_frequency', 'biggest_problem']
    missing = [k for k in required if not _clean(data, k)]
    if missing:
        raise ValueError('缺少必填字段：' + ', '.join(missing))
    cur = conn.execute(
        """
        INSERT INTO assessments(company_name, industry, main_goal, current_channels, posting_frequency,
                                biggest_problem, target_customer, offer, customer_pain, content_assets,
                                monthly_budget, decision_cycle, best_recent_content, contact)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            _clean(data, 'company_name', '未命名客户') or '未命名客户',
            _clean(data, 'industry'),
            _clean(data, 'main_goal'),
            _clean(data, 'current_channels'),
            _clean(data, 'posting_frequency'),
            _clean(data, 'biggest_problem'),
            _clean(data, 'target_customer'),
            _clean(data, 'offer'),
            _clean(data, 'customer_pain'),
            _clean(data, 'content_assets'),
            _clean(data, 'monthly_budget'),
            _clean(data, 'decision_cycle'),
            _clean(data, 'best_recent_content'),
            _clean(data, 'contact'),
        ),
    )
    conn.commit()
    return cur.lastrowid


def _stage(posting_frequency):
    text = posting_frequency or ''
    if any(word in text for word in ['每天', '日更', '稳定']):
        return '稳定优化期'
    if any(word in text for word in ['每周', '一周', '周']):
        return '节奏建立期'
    return '起步诊断期'


def _priority(problem):
    problem = problem or ''
    if '不知道' in problem or '发什么' in problem or '选题' in problem:
        return '选题不稳定'
    if '咨询' in problem or '私信' in problem or '转化' in problem:
        return '内容不转化'
    if '流量' in problem or '曝光' in problem or '播放' in problem:
        return '曝光不足'
    return '营销动作缺少复盘'


def _score(assessment):
    score = 35
    if assessment['target_customer']:
        score += 12
    if assessment['offer']:
        score += 12
    if assessment['best_recent_content']:
        score += 10
    if any(w in assessment['posting_frequency'] for w in ['每周', '每天', '稳定']):
        score += 12
    if any(ch in assessment['current_channels'] for ch in ['视频号', '小红书', '抖音', '公众号']):
        score += 8
    if assessment['customer_pain']:
        score += 6
    if assessment['content_assets']:
        score += 5
    return max(0, min(100, score))


def _field(assessment, key, fallback):
    value = assessment[key] if key in assessment.keys() else ''
    return value or fallback


def generate_diagnosis(conn, assessment_id):
    assessment = conn.execute('SELECT * FROM assessments WHERE id=?', (assessment_id,)).fetchone()
    if not assessment:
        raise ValueError('体检记录不存在')
    stage = _stage(assessment['posting_frequency'])
    priority = _priority(assessment['biggest_problem'])
    score = _score(assessment)
    industry = _field(assessment, 'industry', '当前行业')
    goal = _field(assessment, 'main_goal', '获得更多有效咨询')
    target = _field(assessment, 'target_customer', '目标客户')
    offer = _field(assessment, 'offer', '明确咨询入口')
    pain = _field(assessment, 'customer_pain', assessment['biggest_problem'])
    channels = _field(assessment, 'current_channels', '当前平台')
    frequency = _field(assessment, 'posting_frequency', '当前发布频率')
    problem = _field(assessment, 'biggest_problem', priority)

    if priority == '选题不稳定':
        insight = f'当前「{industry}」的核心目标是「{goal}」，但内容还没有稳定围绕「{target}」和「{pain}」做选题测试。'
        weekly_action = f'本周在「{channels}」连续测试 7 条围绕「{target}」痛点、案例和避坑的内容，先验证哪个角度能带来「{goal}」。'
        next_step = f'先建立一周选题池，每条内容都指向「{offer}」，用反馈数据决定下周加码方向。'
        risk = '不要一开始追求精致大制作；先用低成本内容换真实反馈。'
    elif priority == '内容不转化':
        insight = f'当前「{industry}」内容可能有曝光，但没有把「{target}」从「{pain}」自然带到「{offer}」这个行动。'
        weekly_action = f'本周把「{channels}」内容结尾统一改成围绕「{goal}」的明确咨询入口，并记录私信/咨询数量。'
        next_step = f'把内容结尾改成「{offer}」相关 CTA，并追踪是否真的带来「{goal}」。'
        risk = '只看播放量会误判，第一版必须把咨询数作为核心反馈字段。'
    elif priority == '曝光不足':
        insight = f'当前「{industry}」需要先提升内容第一眼吸引力，让「{target}」一眼看见和自己有关的「{pain}」。'
        weekly_action = f'本周围绕「{pain}」做 7 个不同标题角度，在「{channels}」测试曝光差异。'
        next_step = f'先测标题/封面/开头三要素，再判断是否能承接到「{offer}」。'
        risk = '曝光不足时不要直接加预算，先确认内容钩子是否成立。'
    else:
        insight = f'当前「{industry}」营销动作还没有把「{channels}」发布、用户反馈和「{goal}」连成复盘闭环。'
        weekly_action = f'本周按「{frequency}」固定发布计划和反馈字段，围绕「{target}」完成一次发布-回填-复盘闭环。'
        next_step = f'每条内容发布后24-72小时回填曝光、互动和咨询，判断是否推动「{goal}」。'
        risk = '无回填就无法优化，系统会把“未回填”视为未闭环。'

    cur = conn.execute(
        '''INSERT INTO diagnoses(assessment_id, score, stage, priority_problem, insight, weekly_action, next_step, risk_warning)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
        (assessment_id, score, stage, priority, insight, weekly_action, next_step, risk),
    )
    conn.commit()
    return dict_row(conn.execute('SELECT * FROM diagnoses WHERE id=?', (cur.lastrowid,)).fetchone())


def preferred_platforms(conn, diagnosis_id):
    row = conn.execute(
        'SELECT a.current_channels FROM assessments a JOIN diagnoses d ON d.assessment_id=a.id WHERE d.id=?',
        (diagnosis_id,),
    ).fetchone()
    channels = row['current_channels'] if row else ''
    for raw in channels.replace('，', ',').replace('、', ',').replace('/', ',').split(','):
        platform = raw.strip()
        if platform:
            yield platform


def preferred_platform(conn, diagnosis_id):
    return next(preferred_platforms(conn, diagnosis_id), '小红书')


def _plan_templates(priority, industry, goal, target, offer, pain):
    cta = f'想要{goal}，可以私信了解「{offer}」'
    common = [
        (f'{target}最关心的3个{industry}问题', f'痛点共鸣：围绕「{pain}」说清具体困扰', '短视频/图文', cta, '咨询数'),
        (f'一个真实场景：{target}如何判断是否需要{offer}', '案例信任：前后变化/过程/结果', '短视频', f'评论“方案”获取「{offer}」说明', '私信数'),
        (f'{target}在选择{offer}前最容易忽略什么？', '避坑科普：降低客户决策风险', '图文', f'保存这条，决策前对照检查；需要可私信「{offer}」', '收藏数'),
        (f'为什么你想{goal}，但内容没有带来咨询？', '问题诊断：指出错误动作和修正方式', '短视频', f'把你的情况发来，帮你看如何通过「{offer}」推进', '评论数'),
        (f'{offer}到底能帮{target}解决什么？', '价值说明：用客户语言解释交付结果', '图文', cta, '咨询数'),
        (f'{industry}负责人亲自说：我们如何服务{target}', '人设信任：真实、专业、有温度', '短视频', f'有「{pain}」类似问题可以直接留言', '互动数'),
        (f'本周{target}问得最多的1个问题', 'FAQ：把咨询问题反向变成内容', '短视频/图文', f'还有关于「{offer}」的问题，评论区告诉我', '评论数'),
    ]
    if priority == '曝光不足':
        common[0] = (f'别再忽略：{target}遇到「{pain}」时最容易踩的坑', '强钩子：用高相关痛点提升打开率', '短视频', cta, '曝光数')
    return common


def create_content_plan(conn, diagnosis_id):
    diagnosis = conn.execute('SELECT * FROM diagnoses WHERE id=?', (diagnosis_id,)).fetchone()
    if not diagnosis:
        raise ValueError('诊断记录不存在')
    assessment = conn.execute('SELECT a.* FROM assessments a JOIN diagnoses d ON d.assessment_id=a.id WHERE d.id=?', (diagnosis_id,)).fetchone()
    platforms = list(preferred_platforms(conn, diagnosis_id)) or ['小红书']
    industry = assessment['industry'] or '当前行业'
    goal = assessment['main_goal'] or '获得更多有效咨询'
    target = assessment['target_customer'] or '目标客户'
    offer = assessment['offer'] or '一次免费诊断'
    pain = assessment['customer_pain'] or assessment['biggest_problem'] or '当前核心痛点'
    base = date.today()
    items = []
    conn.execute('DELETE FROM weekly_reviews')
    conn.execute('DELETE FROM feedback')
    conn.execute('DELETE FROM content_plans')
    for idx, (topic, angle, content_type, cta, metric) in enumerate(_plan_templates(diagnosis['priority_problem'], industry, goal, target, offer, pain), start=1):
        cur = conn.execute(
            '''INSERT INTO content_plans(diagnosis_id, planned_date, platform, topic, angle, content_type, cta, target_metric)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (diagnosis_id, (base + timedelta(days=idx - 1)).isoformat(), platforms[(idx - 1) % len(platforms)], topic, angle, content_type, cta, metric),
        )
        items.append(dict_row(conn.execute('SELECT * FROM content_plans WHERE id=?', (cur.lastrowid,)).fetchone()))
    conn.commit()
    return items


def record_feedback(conn, content_plan_id, data):
    plan = conn.execute('SELECT id FROM content_plans WHERE id=?', (content_plan_id,)).fetchone()
    if not plan:
        raise ValueError('发布计划不存在')
    cur = conn.execute(
        '''INSERT INTO feedback(content_plan_id, views, likes, comments, favorites, shares, consultations, publish_link, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (
            content_plan_id,
            int(data.get('views', 0) or 0),
            int(data.get('likes', 0) or 0),
            int(data.get('comments', 0) or 0),
            int(data.get('favorites', 0) or 0),
            int(data.get('shares', 0) or 0),
            int(data.get('consultations', 0) or 0),
            _clean(data, 'publish_link'),
            _clean(data, 'notes'),
        ),
    )
    conn.execute('UPDATE content_plans SET status=?, publish_link=COALESCE(NULLIF(?, \'\'), publish_link) WHERE id=?', ('已发布', _clean(data, 'publish_link'), content_plan_id))
    conn.commit()
    return dict_row(conn.execute('SELECT * FROM feedback WHERE id=?', (cur.lastrowid,)).fetchone())


def list_assessments(conn):
    return [dict_row(r) for r in conn.execute('SELECT * FROM assessments ORDER BY id DESC').fetchall()]


def list_diagnoses(conn):
    return [dict_row(r) for r in conn.execute('SELECT * FROM diagnoses ORDER BY id DESC').fetchall()]


def list_plans(conn):
    return [dict_row(r) for r in conn.execute('SELECT * FROM content_plans ORDER BY planned_date, id').fetchall()]


def list_feedback(conn):
    return [dict_row(r) for r in conn.execute('SELECT * FROM feedback ORDER BY id DESC').fetchall()]


def list_reviews(conn):
    return [dict_row(r) for r in conn.execute('SELECT * FROM weekly_reviews ORDER BY id DESC').fetchall()]


def create_weekly_review(conn):
    rows = conn.execute(
        '''SELECT f.*, p.topic FROM feedback f JOIN content_plans p ON p.id=f.content_plan_id ORDER BY f.id DESC'''
    ).fetchall()
    total_posts = len(rows)
    total_views = sum(r['views'] for r in rows)
    total_interactions = sum(r['likes'] + r['comments'] + r['favorites'] + r['shares'] for r in rows)
    total_consultations = sum(r['consultations'] for r in rows)
    winner = None
    if rows:
        winner = max(rows, key=lambda r: (r['consultations'], r['favorites'] + r['comments'], r['views']))
    if not rows:
        bottleneck = '暂无反馈数据'
        next_actions = '先完成至少1条内容发布和反馈回填，否则无法复盘。'
    elif total_consultations > 0:
        bottleneck = '需要扩大有效内容样本'
        next_actions = f'加码「{winner["topic"]}」同类角度，下周至少复制3条，并保留相同CTA。'
    elif total_views < 1000:
        bottleneck = '曝光不足'
        next_actions = '优先优化标题/封面/开头，先获得足够曝光样本。'
    else:
        bottleneck = '转化不足'
        next_actions = '已有曝光但咨询不足，下周强化痛点表达、案例信任和明确咨询入口。'
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    cur = conn.execute(
        '''INSERT INTO weekly_reviews(week_start, week_end, total_posts, total_views, total_interactions,
                                      total_consultations, winner_topic, bottleneck, next_actions)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (week_start.isoformat(), week_end.isoformat(), total_posts, total_views, total_interactions,
         total_consultations, winner['topic'] if winner else '', bottleneck, next_actions),
    )
    conn.commit()
    return dict_row(conn.execute('SELECT * FROM weekly_reviews WHERE id=?', (cur.lastrowid,)).fetchone())


def dashboard_metrics(conn):
    total_plans = conn.execute('SELECT COUNT(*) c FROM content_plans').fetchone()['c']
    published = conn.execute("SELECT COUNT(*) c FROM content_plans WHERE status='已发布'").fetchone()['c']
    fb = conn.execute('''SELECT COALESCE(SUM(views),0) views, COALESCE(SUM(likes+comments+favorites+shares),0) interactions,
                                COALESCE(SUM(consultations),0) consultations FROM feedback''').fetchone()
    latest_review = conn.execute('SELECT * FROM weekly_reviews ORDER BY id DESC LIMIT 1').fetchone()
    consultations = fb['consultations']
    feedback_rate = (published / total_plans) if total_plans else 0
    if consultations > 0:
        suggestion = '加码：已有内容带来咨询，下周复制最高咨询主题并保留CTA。'
    elif published > 0:
        suggestion = '优化：已有发布但暂无咨询，下周强化结尾引导和客户痛点表达。'
    else:
        suggestion = '先执行：还没有发布反馈，优先完成第一条内容发布和数据回填。'
    return {
        'total_plans': total_plans,
        'published_plans': published,
        'feedback_rate': feedback_rate,
        'total_views': fb['views'],
        'total_interactions': fb['interactions'],
        'total_consultations': consultations,
        'next_suggestion': latest_review['next_actions'] if latest_review else suggestion,
    }


def seed_demo_data(conn):
    if conn.execute('SELECT COUNT(*) c FROM assessments').fetchone()['c']:
        return
    assessment_id = create_assessment(conn, {
        'company_name': '示例本地服务机构',
        'industry': '本地服务',
        'main_goal': '获得更多咨询',
        'current_channels': '视频号, 小红书',
        'posting_frequency': '偶尔发布',
        'biggest_problem': '不知道发什么',
        'target_customer': '有明确需求的本地客户',
        'offer': '一次免费咨询',
        'customer_pain': '不知道如何判断服务是否适合自己',
        'content_assets': '客户案例、服务过程照片',
        'best_recent_content': '客户案例内容',
        'contact': '赵娜'
    })
    diagnosis = generate_diagnosis(conn, assessment_id)
    create_content_plan(conn, diagnosis['id'])
