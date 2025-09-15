# db.py
# -*- coding: utf-8 -*-
"""
- 스키마 버전: PRAGMA user_version(정수)
- DB 식별   : PRAGMA application_id(law/casely 구분)
- HTTP: 요청마다 커넥션 열고 닫기(law=RO가 기본, 필요 시 law_rw=True)
- SQL은 이 파일 안에서만 관리 (외부는 함수형 API만 사용)
스키마 버전 1: contracts(user_updated_at), labels, contract_label, issues
"""

from __future__ import annotations
import os
import contextlib
import json
import sqlite3
import time
from typing import Any, Iterable, Optional, Tuple


# -------------------------------------------------
# 상수/유틸
# -------------------------------------------------

CASELY_DB_PATH = "casely.db"
CASELY_APP_ID = 0x43415345  # 'CASE'
CASE_TARGET_VER = 2  # 마이그레이션 반영


def now_ms() -> int:
    return int(time.time() * 1000)


def _dict_factory(cur: sqlite3.Cursor, row: Tuple[Any, ...]) -> dict:
    return {desc[0]: row[i] for i, desc in enumerate(cur.description)}


def _apply_common_pragmas(conn: sqlite3.Connection) -> None:
    conn.row_factory = _dict_factory
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA busy_timeout=5000")


def _ensure_wal(conn: sqlite3.Connection) -> None:
    try:
        conn.execute("PRAGMA journal_mode=WAL")
    except sqlite3.DatabaseError:
        pass


def _set_query_only(conn: sqlite3.Connection) -> None:
    # 읽기 전용 모드 가드
    try:
        conn.execute("PRAGMA query_only=ON")
    except sqlite3.DatabaseError:
        pass
    try:

        def auth_cb(action, p1, p2, dbname, source):
            deny_ops = {
                getattr(sqlite3, k)
                for k in dir(sqlite3)
                if k.startswith("SQLITE_")
                and any(
                    x in k
                    for x in (
                        "INSERT",
                        "UPDATE",
                        "DELETE",
                        "TRANSACTION",
                        "ALTER",
                        "ATTACH",
                        "DETACH",
                        "VACUUM",
                        "REINDEX",
                        "CREATE",
                        "DROP",
                    )
                )
            }
            return sqlite3.SQLITE_DENY if action in deny_ops else sqlite3.SQLITE_OK

        conn.set_authorizer(auth_cb)  # type: ignore[attr-defined]
    except Exception:
        pass


import hashlib


def compute_hash(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


# -------------------------------------------------
# 커넥션 팩토리/컨텍스트
# -------------------------------------------------
def open_rw() -> sqlite3.Connection:
    conn = sqlite3.connect(CASELY_DB_PATH, isolation_level=None, check_same_thread=True)
    _apply_common_pragmas(conn)
    _ensure_wal(conn)
    return conn


def open_ro() -> sqlite3.Connection:
    uri = f"file:{CASELY_DB_PATH}?mode=ro&cache=shared"
    conn = sqlite3.connect(uri, uri=True, isolation_level=None, check_same_thread=True)
    _apply_common_pragmas(conn)
    _set_query_only(conn)
    return conn


@contextlib.contextmanager
def tx_immediate(conn: sqlite3.Connection):
    """짧은 쓰기 트랜잭션."""
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield
        conn.execute("COMMIT")
    except Exception:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass  # 이미 롤백된 경우 등은 무시
        raise


# -------------------------------------------------
# PRAGMA helpers
# -------------------------------------------------
def _get_user_version(conn: sqlite3.Connection) -> int:
    row = conn.execute("PRAGMA user_version").fetchone()
    return int(list(row.values())[0])


def _set_user_version(conn: sqlite3.Connection, v: int) -> None:
    conn.execute(f"PRAGMA user_version={int(v)}")


def _set_application_id(conn: sqlite3.Connection, app_id: int) -> None:
    conn.execute(f"PRAGMA application_id={int(app_id)}")


# -------------------------------------------------
# 마이그레이션/초기화
# -------------------------------------------------


# casely.db에 contracts, meta_data, labels_catalog 테이블 생성/마이그레이션
def _migrate_casely(conn: sqlite3.Connection) -> None:
    """
    v2:
        contracts(
            id PK,
            detail_json, chats_json, extra_json,
            detail_hash, chats_hash,
            fetched_at, updated_at, deleted_at
        )
        meta_data(key,value,updated_at)
        labels(
            id INTEGER PRIMARY KEY,
            name, color, order_rank, updated_at
        )
    """
    _ensure_wal(conn)
    cur_ver = _get_user_version(conn)
    if cur_ver < 1:
        _set_application_id(conn, CASELY_APP_ID)
        conn.executescript(
            """
CREATE TABLE IF NOT EXISTS contracts (
    id                INTEGER PRIMARY KEY,
    detail_json       TEXT CHECK (detail_json IS NULL OR json_valid(detail_json)),
    chats_json        TEXT CHECK (chats_json  IS NULL OR json_valid(chats_json)),
    detail_hash       TEXT,
    chats_hash        TEXT,
    source_fetched_at INTEGER NOT NULL DEFAULT 0,
    source_updated_at INTEGER NOT NULL DEFAULT 0,
    user_updated_at   INTEGER NOT NULL DEFAULT 0,
    notes             TEXT,
    deleted_at        INTEGER DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS labels (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    color      TEXT,
    order_rank INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS contract_label (
    contract_id INTEGER NOT NULL,
    label_id    INTEGER NOT NULL,
    PRIMARY KEY (contract_id, label_id),
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS issues (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id  INTEGER NOT NULL,
    kind         TEXT NOT NULL,
    title        TEXT NOT NULL,
    body         TEXT,
    notes        TEXT,
    status       TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS meta_data (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_contracts_fetched ON contracts(source_fetched_at);
CREATE INDEX IF NOT EXISTS idx_contracts_updated ON contracts(source_updated_at);
CREATE INDEX IF NOT EXISTS idx_labels_last_updated ON labels(updated_at);
        """
        )
        _set_user_version(conn, 1)
        cur_ver = 1


def init_all():
    cas = open_rw()
    try:
        _migrate_casely(cas)
    finally:
        cas.close()


# -------------------------------------------------
# 요청 스코프 커넥션 (HTTP)
# -------------------------------------------------


@contextlib.contextmanager
def request_conns(readonly: bool = True):
    if readonly:
        cas = open_ro()
    else:
        cas = open_rw()
    try:
        yield cas
    finally:
        cas.close()


def open_poller_law() -> sqlite3.Connection:
    return open_rw()


# -------------------------------------------------
# meta_data
# -------------------------------------------------
def casely_meta_get(conn: sqlite3.Connection, key: str) -> Optional[dict]:
    row = conn.execute("SELECT value FROM meta_data WHERE key=?", (key,)).fetchone()
    if not row or row["value"] is None:
        return None
    try:
        return json.loads(row["value"])
    except Exception:
        return None


def casely_meta_set(conn: sqlite3.Connection, key: str, value_obj: dict) -> None:
    v = json.dumps(value_obj, ensure_ascii=False, separators=(",", ":"))
    ts = now_ms()
    with tx_immediate(conn):
        conn.execute(
            """
        INSERT INTO meta_data(key,value,updated_at)
        VALUES(?,?,?)
        ON CONFLICT(key) DO UPDATE SET
          value=excluded.value,
          updated_at=excluded.updated_at
        """,
            (key, v, ts),
        )


def casely_get_contracts_max_updated_at(conn: sqlite3.Connection) -> int:
    row = conn.execute(
        "SELECT COALESCE(MAX(updated_at), 0) AS m FROM contracts"
    ).fetchone()
    return int(row["m"] or 0)


def casely_get_contract(conn: sqlite3.Connection, id: str) -> Optional[dict]:
    return conn.execute("SELECT * FROM contracts WHERE id=?", (id,)).fetchone()


def casely_delete_contract(conn: sqlite3.Connection, id: str) -> int:
    """
    Soft delete: set deleted_at=now, user_updated_at=now
    """
    now = now_ms()
    with tx_immediate(conn):
        cur = conn.execute(
            "UPDATE contracts SET deleted_at=?, user_updated_at=? WHERE id=? AND deleted_at IS NULL",
            (now, now, id),
        )
        return cur.rowcount

# 라벨 소프트 삭제

def casely_delete_label(conn: sqlite3.Connection, id: int) -> int:
    """
    Soft delete: set deleted_at=now, updated_at=now
    """
    now = now_ms()
    with tx_immediate(conn):
        cur = conn.execute(
            "UPDATE labels SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL",
            (now, now, id),
        )
        return cur.rowcount


def casely_upsert_label_def(
    conn: sqlite3.Connection,
    *,
    id: int,
    name: str,
    color: Optional[str] = None,
    order_rank: Optional[int] = None,
    updated_at_ms: Optional[int] = None,
) -> None:
    ts = updated_at_ms or now_ms()
    with tx_immediate(conn):
        conn.execute(
            """
        INSERT INTO labels(id,name,color,order_rank,updated_at)
        VALUES(?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name,
          color=excluded.color,
          order_rank=excluded.order_rank,
          updated_at=excluded.updated_at
        """,
            (int(id), name, color, order_rank, ts),
        )

def casely_get_label_defs_since(conn: sqlite3.Connection, since_ms: int) -> list[dict]:
    return conn.execute(
        """
    SELECT id,name,color,order_rank,updated_at
    FROM labels
    WHERE updated_at > ?
    ORDER BY updated_at ASC, id ASC
    """,
        (since_ms,),
    ).fetchall()



# 전체 라벨 반환 (id ASC)
def casely_get_labels_all(conn: sqlite3.Connection) -> list[dict]:
    """
    Returns all labels, ordered by id ASC.
    """
    return conn.execute(
        "SELECT id, name, color, order_rank, updated_at FROM labels ORDER BY id ASC"
    ).fetchall()


# --- SYNC HELPERS ---
def casely_get_contracts_sync(conn: sqlite3.Connection, since_ms: int) -> dict:
    # snapshot: source_updated_at > since OR user_updated_at > since (including deleted rows)
    rows = conn.execute(
        """
        SELECT * FROM contracts
        WHERE (source_updated_at > ? OR user_updated_at > ?)
        """,
        (since_ms, since_ms),
    ).fetchall()
    return rows


def casely_get_labels_sync(conn: sqlite3.Connection, since_ms: int) -> dict:
    # snapshot: updated_at > since (including deleted rows), only valid fields
    rows = conn.execute(
        """
        SELECT id, name, color, order_rank, updated_at, deleted_at
        FROM labels
        WHERE updated_at > ?
        """,
        (since_ms,),
    ).fetchall()
    return rows


# -------------------------------------------------
#
# -------------------------------------------------
def casely_get_contracts_since_all(
    conn, updated_since: int = None, only_not_deleted: bool = True
) -> list[dict]:
    """
    updated_since가 주어지면 updated_at > updated_since,
    아니면 전체 contracts 반환
    only_not_deleted=True면 deleted_at IS NULL인 것만 반환
    """
    if only_not_deleted:
        if updated_since is not None:
            return conn.execute(
                "SELECT * FROM contracts WHERE (source_updated_at > ? OR user_updated_at > ?) AND deleted_at IS NULL ORDER BY updated_at ASC",
                (updated_since, updated_since),
            ).fetchall()
        else:
            return conn.execute(
                "SELECT * FROM contracts WHERE deleted_at IS NULL"
            ).fetchall()
    else:
        if updated_since is not None:
            return conn.execute(
                "SELECT * FROM contracts WHERE (source_updated_at > ? OR user_updated_at > ?) ORDER BY updated_at ASC",
                (updated_since, updated_since),
            ).fetchall()
        else:
            return conn.execute("SELECT * FROM contracts").fetchall()


def casely_set_contract_labels(conn: sqlite3.Connection, contract_id: int, label_ids: list[int]) -> None:
    """
    Replace all labels for a contract with the given label_ids.
    """
    with tx_immediate(conn):
        conn.execute("DELETE FROM contract_label WHERE contract_id=?", (contract_id,))
        if label_ids:
            conn.executemany(
                "INSERT INTO contract_label (contract_id, label_id) VALUES (?, ?)",
                [(contract_id, lid) for lid in label_ids],
            )

def casely_delete_contract_labels(conn: sqlite3.Connection, contract_id: int) -> None:
    """
    Remove all labels from a contract.
    """
    with tx_immediate(conn):
        conn.execute("DELETE FROM contract_label WHERE contract_id=?", (contract_id,))

def casely_add_contract_label(conn: sqlite3.Connection, contract_id: int, label_id: int) -> int:
    """
    Add a label to a contract (if not already present) and update user_updated_at.
    Returns the new user_updated_at timestamp.
    """
    now = now_ms()
    with tx_immediate(conn):
        conn.execute(
            "INSERT OR IGNORE INTO contract_label (contract_id, label_id) VALUES (?, ?)",
            (contract_id, label_id),
        )
        conn.execute(
            "UPDATE contracts SET user_updated_at=? WHERE id=?",
            (now, contract_id),
        )
    return now

def casely_remove_contract_label(conn: sqlite3.Connection, contract_id: int, label_id: int) -> int:
    """
    Remove a label from a contract (if present) and update user_updated_at.
    Returns the new user_updated_at timestamp.
    """
    now = now_ms()
    with tx_immediate(conn):
        conn.execute(
            "DELETE FROM contract_label WHERE contract_id=? AND label_id=?",
            (contract_id, label_id),
        )
        conn.execute(
            "UPDATE contracts SET user_updated_at=? WHERE id=?",
            (now, contract_id),
        )
    return now

def casely_upsert_fetched_contract(
    conn,
    *,
    id: int,
    detail_json_str: str,
    chats_json_str: str,
    fetched_at_ms: int,
) -> bool:
    """
    기존 해시와 비교:
      - 해시 동일: JSON/해시는 그대로 두고 source_fetched_at만 갱신 → return False
      - 해시 다름: JSON/해시 교체 + source_fetched_at=NOW + source_updated_at=NOW → return True
      - 행이 없으면: INSERT(모든 필드) → return True
    """
    cid = str(id)

    detail_hash = compute_hash(detail_json_str)
    chats_hash = compute_hash(chats_json_str)
    row = conn.execute(
        "SELECT detail_hash, chats_hash FROM contracts WHERE id=?", (cid,)
    ).fetchone()

    if row is None:
        with tx_immediate(conn):
            conn.execute(
                """
                INSERT INTO contracts(
                  id, detail_json, chats_json,
                  detail_hash, chats_hash,
                  source_fetched_at, source_updated_at
                )
                VALUES(?, json(?), json(?), ?, ?, ?, ?)
            """,
                (
                    cid,
                    detail_json_str,
                    chats_json_str,
                    detail_hash,
                    chats_hash,
                    fetched_at_ms,
                    fetched_at_ms,
                ),
            )
        return True

    same = (row["detail_hash"] == detail_hash) and (row["chats_hash"] == chats_hash)
    if same:
        with tx_immediate(conn):
            conn.execute(
                "UPDATE contracts SET source_fetched_at=? WHERE id=?", (fetched_at_ms, cid)
            )
        return False

    with tx_immediate(conn):
        conn.execute(
            """
            UPDATE contracts SET
              detail_json = json(?),
              chats_json  = json(?),
              detail_hash = ?,
              chats_hash  = ?,
              source_fetched_at  = ?,
              source_updated_at  = ?
            WHERE id=?
        """,
            (
                detail_json_str,
                chats_json_str,
                detail_hash,
                chats_hash,
                fetched_at_ms,
                fetched_at_ms,
                cid,
            ),
        )
    return True


def casely_get_stale_contract_ids(conn, *, older_than_ms: int, limit: int) -> list[int]:
    """
    fetched_at < older_than_ms 인 계약들을 오래된 순으로 최대 limit개 반환.
    """
    rows = conn.execute(
        """
        SELECT id
        FROM contracts
        WHERE (source_fetched_at IS NULL OR source_fetched_at < ?) AND deleted_at IS NULL
        ORDER BY source_fetched_at ASC, id ASC
        LIMIT ?
    """,
        (older_than_ms, int(limit)),
    ).fetchall()
    
    return [r["id"] for r in rows]


def casely_touch_fetched_at(conn, *, id: int, fetched_at_ms: int) -> None:
    """콘텐츠가 변하지 않았을 때 fetched_at만 NOW로 갱신."""
    cid = str(id)
    with tx_immediate(conn):
        conn.execute(
            "UPDATE contracts SET source_fetched_at=? WHERE id=?", (fetched_at_ms, cid)
        )