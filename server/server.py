#!/usr/bin/env python3
"""
Casely 서버
"""

import http.server
import socketserver
import json
from urllib.parse import urlparse, parse_qs
import os
from datetime import datetime

# from .utils import log_message


from .polling import PollerConfig
from .db import init_all


import queue

# 폴링 메시지 큐 (전역)
polling_queue = queue.Queue()


class RequestHandler(http.server.SimpleHTTPRequestHandler):

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        from .db import casely_meta_get, request_conns

        if self.path.startswith("/api/labels"):
            url = urlparse(self.path)
            qs = parse_qs(url.query)
            updated_since = int(qs.get("updated_since", ["0"])[0])

            with request_conns() as conn:
                items = conn.execute("SELECT * FROM labels WHERE updated_at > ?", (updated_since,)).fetchall()
                
            max_updated_at = updated_since
            for item in items:
                item["updated_at"] = max(item.get("updated_at", 0) or 0, item.get("deleted_at", 0) or 0)
                if item["updated_at"] > max_updated_at:
                    max_updated_at = item["updated_at"]
            
            self.send_json_response({
                "max_updated_at": max_updated_at,
                "items": items
            })
            return

        if self.path == "/api/auth":
            with request_conns() as conn:
                data = casely_meta_get(conn, "auth")
            if data is None:
                data = {}
            self.send_json_response(data)
            return

        if self.path.startswith("/api/contracts"):
            url = urlparse(self.path)
            qs = parse_qs(url.query)
            updated_since = int(qs.get("updated_since", ["0"])[0])
            allow_deleted = qs.get("allow_deleted", ["0"])[0] == "1"

            with request_conns() as conn:
                sql = "SELECT * FROM contracts WHERE (source_updated_at > ? OR user_updated_at > ?)"
                if not allow_deleted:
                    sql += " AND deleted_at IS NULL"
                items = conn.execute(sql, (updated_since, updated_since)).fetchall()

            max_updated_at = updated_since
            for item in items:
                item["detail"] = json.loads(item.pop("detail_json"))
                item["chats"] = json.loads(item.pop("chats_json"))
                item["updated_at"] = max(
                    item.get("source_updated_at", 0),
                    item.get("user_updated_at", 0),
                    item.get("deleted_at", 0) or 0
                )
                if item["updated_at"] > max_updated_at:
                    max_updated_at = item["updated_at"]

            self.send_json_response({
                "max_updated_at": max_updated_at,
                "items": items
            })
            return

        elif self.path.startswith("/api/"):
            self.send_response(404)
            self.end_headers()
            return
        else:
            # Use parent static file handler
            return super().do_GET()

    def do_PUT(self):
        from .db import request_conns
        import re

        # PUT /api/contracts/{id}/labels (add single label)
        m = re.match(r"/api/contracts/(\d+)/labels$", self.path)
        if m:
            contract_id = int(m.group(1))
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self.send_json_response({"error": "Empty body"}, status=400)
                return
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                label_id = data.get("labelId")
                if not isinstance(label_id, int):
                    raise ValueError("labelId must be an int")
            except Exception:
                self.send_json_response(
                    {"error": "Invalid JSON or missing 'labelId'"}, status=400
                )
                return
            from .db import casely_add_contract_label

            with request_conns(readonly=False) as conn:
                updated_at = casely_add_contract_label(conn, contract_id, label_id)
            self.send_json_response({"status": "ok", "updatedAt": updated_at})
            return

        self.send_response(404)
        self.end_headers()

    def do_DELETE(self):
        from .db import request_conns
        import re

        # DELETE /api/contracts/{id}/labels (remove single label)
        m = re.match(r"/api/contracts/(\d+)/labels$", self.path)
        if m:
            contract_id = int(m.group(1))
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Empty body")
                return
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                label_id = data.get("labelId")
                if not isinstance(label_id, int):
                    raise ValueError("labelId must be an int")
            except Exception:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Invalid JSON or missing 'labelId'")
                return
            from .db import casely_remove_contract_label

            with request_conns(readonly=False) as conn:
                updated_at = casely_remove_contract_label(conn, contract_id, label_id)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps({"status": "ok", "updatedAt": updated_at}).encode("utf-8")
            )
            return
        self.send_response(404)
        self.end_headers()

    # 라벨 추가/제거 엔드포인트 완전 제거
    def send_header(self, keyword, value):
        # 모든 응답에 CORS 허용 헤더 추가
        if keyword.lower() == "content-type":
            super().send_header("Access-Control-Allow-Origin", "*")
        super().send_header(keyword, value)

    def end_headers(self):
        # preflight 요청 등 추가 CORS 헤더 필요시 여기에 추가 가능
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    # def log_message(self, format, *args):
    #     pass  # 아무것도 하지 않음 → 기본 로그 suppress

    def do_POST(self):
        if self.path == "/api/auth":
            self.log_message("Received /api/auth POST request")

            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self.send_json_response({"status": "ok"})
                return
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                self.send_json_response({"status": "ok"})
                return
            access_token = data.get("access_token")
            user_id = data.get("userId")
            if not access_token or not user_id:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"access_token and userId required")
                return
            # 메시지를 polling 쓰레드로 전달
            polling_queue.put(
                {"type": "set_auth", "access_token": access_token, "userId": user_id}
            )
            self.send_json_response({"status": "ok"})
            return
        # elif self.path == "/api/sync":
        #     # Sync endpoint: expects JSON body { since: { contract: ms, label: ms } }
        #     content_length = int(self.headers.get("Content-Length", 0))
        #     if content_length == 0:
        #         self.send_response(400)
        #         self.end_headers()
        #         self.wfile.write(b"Empty body")
        #         return
        #     body = self.rfile.read(content_length)
        #     try:
        #         data = json.loads(body.decode("utf-8"))
        #         since = data.get("since", {})
        #         contracts_since = int(since.get("contracts", 0))
        #         labels_since = int(since.get("labels", 0))
        #     except Exception:
        #         self.send_response(400)
        #         self.end_headers()
        #         self.wfile.write(b"Invalid JSON or missing 'since'")
        #         return
        #     from .db import (
        #         casely_get_contracts_sync,
        #         casely_get_labels_sync,
        #         request_conns,
        #     )

        #     with request_conns() as conn:
        #         contracts = casely_get_contracts_sync(conn, contracts_since)
        #         labels = casely_get_labels_sync(conn, labels_since)

        #     # detail_json, chats_json을 파싱해서 반환
        #     def contract_to_api(row):
        #         out = row
        #         out["id"] = row.get("id")
        #         out["detail"] = json.loads(row.pop("detail_json"))
        #         out["chats"] = json.loads(row.pop("chats_json"))
        #         out["updated_at"] = max(
        #             row.get("source_updated_at", 0), row.get("user_updated_at", 0)
        #         )
        #         return out

        #     contracts_api = [contract_to_api(dict(r)) for r in contracts]
        #     resp = {"contracts": contracts_api, "labels": labels}
        #     self.send_json_response(resp)
        #     return
        else:
            self.send_response(404)
            self.end_headers()


def run_server(port=8080):
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    handler = lambda *args, **kwargs: RequestHandler(
        *args, directory=static_dir, **kwargs
    )

    # ThreadedTCPServer 커스텀: 포트 재사용 및 데몬 스레드
    class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
        allow_reuse_address = True
        daemon_threads = True

    # 폴링 설정 등록 및 별도 쓰레드에서 실행
    config = PollerConfig(base_url="http://localhost:8000", sleep_between_pages_s=1)
    from .polling import init_poller

    init_poller(config)

    # polling.py의 start_poller에 큐를 넘겨줌
    from .polling import start_poller as polling_start_poller

    polling_start_poller(polling_queue)

    with ThreadedTCPServer(("", port), handler) as httpd:
        print(f"Server running on port {port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다...")
            httpd.shutdown()


if __name__ == "__main__":
    try:
        init_all()
        # 기본 라벨 자동 추가 (존재하지 않을 때만)
        from .db import open_rw

        default_labels = [
            (1, "주의"),
            (2, "검토완료"),
            (3, "작업완료"),
        ]
        with open_rw() as conn:
            for id, name in default_labels:
                row = conn.execute("SELECT 1 FROM labels WHERE id=?", (id,)).fetchone()
                if not row:
                    conn.execute(
                        "INSERT INTO labels (id, name, updated_at) VALUES (?, ?, ?)",
                        (id, name, int(datetime.now().timestamp() * 1000)),
                    )
        run_server()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
