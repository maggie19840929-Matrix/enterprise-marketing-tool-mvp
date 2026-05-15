#!/usr/bin/env python3
from pathlib import Path
from business import connect, seed_demo_data, dashboard_metrics

DB_PATH = Path(__file__).resolve().parent / 'marketing_mvp.sqlite3'

with connect(DB_PATH) as conn:
    seed_demo_data(conn)
    print('Demo data ready:', dashboard_metrics(conn))
