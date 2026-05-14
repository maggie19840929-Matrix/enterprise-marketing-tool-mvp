-- 企业营销工具｜轻量级 Web 业务管理系统 MVP 数据库结构
-- 可用于 SQLite 原型；如迁移 PostgreSQL，需调整自增字段类型。

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  source_channel TEXT,
  need_summary TEXT,
  intent_level TEXT DEFAULT '待判断',
  stage TEXT DEFAULT '新线索',
  owner TEXT,
  next_action TEXT,
  next_follow_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS followups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  followup_time TEXT DEFAULT CURRENT_TIMESTAMP,
  method TEXT,
  content TEXT,
  customer_feedback TEXT,
  next_action TEXT,
  next_follow_date TEXT,
  result_status TEXT,
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS marketing_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  channel TEXT,
  publish_date TEXT,
  target_customer TEXT,
  message TEXT,
  cost REAL DEFAULT 0,
  owner TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS activity_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL,
  date TEXT,
  exposure_count INTEGER DEFAULT 0,
  inquiry_count INTEGER DEFAULT 0,
  lead_count INTEGER DEFAULT 0,
  appointment_count INTEGER DEFAULT 0,
  deal_count INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0,
  notes TEXT,
  FOREIGN KEY(activity_id) REFERENCES marketing_activities(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  customer_id INTEGER,
  priority TEXT DEFAULT '中',
  due_date TEXT,
  owner TEXT,
  status TEXT DEFAULT '待处理',
  result TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);
