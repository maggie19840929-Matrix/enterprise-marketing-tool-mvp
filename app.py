#!/usr/bin/env python3
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from business import (
    connect,
    seed_demo_data,
    create_assessment,
    generate_diagnosis,
    create_content_plan,
    record_feedback,
    create_weekly_review,
    list_assessments,
    list_diagnoses,
    list_plans,
    list_feedback,
    list_reviews,
    dashboard_metrics,
)

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / 'static'
DB_PATH = os.environ.get('MVP_DB', str(ROOT / 'marketing_mvp.sqlite3'))


def json_response(handler, payload, status=200):
    body = json.dumps(payload, ensure_ascii=False, indent=2).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print('[mvp]', fmt % args)

    def db(self):
        return connect(DB_PATH)

    def read_json(self):
        length = int(self.headers.get('Content-Length', 0))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode('utf-8'))

    def do_GET(self):
        path = urlparse(self.path).path
        try:
            if path == '/api/health':
                return json_response(self, {'ok': True, 'db': DB_PATH})
            if path == '/api/dashboard':
                with self.db() as conn:
                    return json_response(self, dashboard_metrics(conn))
            if path == '/api/assessments':
                with self.db() as conn:
                    return json_response(self, list_assessments(conn))
            if path == '/api/diagnoses':
                with self.db() as conn:
                    return json_response(self, list_diagnoses(conn))
            if path == '/api/plans':
                with self.db() as conn:
                    return json_response(self, list_plans(conn))
            if path == '/api/feedback':
                with self.db() as conn:
                    return json_response(self, list_feedback(conn))
            if path == '/api/reviews':
                with self.db() as conn:
                    return json_response(self, list_reviews(conn))
            return self.serve_static(path)
        except Exception as exc:
            return json_response(self, {'error': str(exc)}, 500)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            payload = self.read_json()
            with self.db() as conn:
                if path == '/api/assessments':
                    assessment_id = create_assessment(conn, payload)
                    diagnosis = generate_diagnosis(conn, assessment_id)
                    plans = create_content_plan(conn, diagnosis['id'])
                    return json_response(self, {'assessment_id': assessment_id, 'diagnosis': diagnosis, 'plans': plans}, 201)
                if path == '/api/feedback':
                    plan_id = int(payload.pop('content_plan_id'))
                    feedback = record_feedback(conn, plan_id, payload)
                    return json_response(self, {'feedback': feedback, 'dashboard': dashboard_metrics(conn)}, 201)
                if path == '/api/reviews':
                    review = create_weekly_review(conn)
                    return json_response(self, {'review': review, 'dashboard': dashboard_metrics(conn)}, 201)
            return json_response(self, {'error': '未知接口'}, 404)
        except Exception as exc:
            return json_response(self, {'error': str(exc)}, 400)

    def serve_static(self, path):
        if path == '/':
            path = '/index.html'
        file_path = (STATIC / path.lstrip('/')).resolve()
        if not str(file_path).startswith(str(STATIC.resolve())) or not file_path.exists() or not file_path.is_file():
            return json_response(self, {'error': 'Not found'}, 404)
        content = file_path.read_bytes()
        ctype = 'text/html; charset=utf-8'
        if file_path.suffix == '.css':
            ctype = 'text/css; charset=utf-8'
        elif file_path.suffix == '.js':
            ctype = 'application/javascript; charset=utf-8'
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)


def main():
    with connect(DB_PATH) as conn:
        seed_demo_data(conn)
    port = int(os.environ.get('PORT', '8787'))
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'企业营销工具 MVP 已启动：http://127.0.0.1:{port}')
    print(f'数据库：{DB_PATH}')
    server.serve_forever()


if __name__ == '__main__':
    main()
