# polling.py
# -*- coding: utf-8 -*-

"""
Constraints:
- Only Python standard library (no external deps).
- All origin requests are POST with JSON bodies.
- LIST filter: businessWorkDsticText ∈ {"매뉴얼", "규정지침 + 매뉴얼"}.
- Cursor rule: use max(stored_max_id_seen or 0, min_contract_id - 1) as effective lower bound.
- If HTTP status 209 is received, pause polling until new access_token is saved.

Includes:
  • PollerConfig/AuthInfo/RemoteListItem/DetailPayload dataclasses
  • Cursor (meta_data) helpers
  • Auth (meta_data:'auth') helpers
  • Remote API adapters (POST via urllib)
  • Poll loop (poll_pages_once / poll_forever) and TTL refresh
  • Utilities (hash, remove_filetext_fields)
"""

from __future__ import annotations


import json
import threading
import time
import queue
from dataclasses import dataclass
from typing import Optional, Dict, Any, List, Tuple
from urllib import request as _urlreq
from urllib.error import URLError, HTTPError

from .utils import log_message
from . import db as _db  # for optional helpers to be added next step

# ---------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------
LIST_PATH = "/api/contract/list"
DETAIL_PATH = "/api/contract/detail"
CHATS_PATH = "/api/chat/list"

# ---------------------------------------------------------------------
# Types / Config
# ---------------------------------------------------------------------

@dataclass
class PollerConfig:
    base_url: str
    page_size: int = 20
    sleep_between_items_s: float = 0.1
    sleep_between_pages_s: float = 1.0
    http_timeout_s: float = 10.0

    min_contract_id: int = 14881  # for cursor effective lower bound
    refresh_ttl_ms: Optional[int] = 1 * 60_000  # 1 min by default (None = disabled)

@dataclass
class AuthInfo:
    access_token: str  # meta_data['auth']._bak_t
    user_id: str       # meta_data['auth'].userId

@dataclass
class RemoteListItem:
    id: int
    meta: Optional[Dict[str, Any]] = None

@dataclass
class DetailPayload:
    detail_json_str: str
    chats_json_str: str

# ---------------------------------------------------------------------
# Internal globals
# ---------------------------------------------------------------------
_cfg: Optional[PollerConfig] = None
_thread: Optional[threading.Thread] = None
_stop_event: Optional[threading.Event] = None
_auth_paused: bool = False  # becomes True if status 209 is seen

# ---------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------

_polling_queue: Optional[queue.Queue] = None

def init_poller(config: PollerConfig) -> None:
    """Register config. (No thread start here.)"""
    global _cfg
    _cfg = config

def _run_forever() -> None:
    poll_forever()

def start_poller(polling_queue: Optional[queue.Queue] = None) -> None:
    """Start background poller thread. (optionally with message queue)"""

    global _thread, _stop_event
    global _polling_queue; _polling_queue = polling_queue

    if _thread and _thread.is_alive():
        return
    _stop_event = threading.Event()
    def poller_main():
        # 메시지 큐는 poll_forever에서만 처리
        _run_forever()

    _thread = threading.Thread(target=poller_main, name="casely-poller", daemon=True)
    _thread.start()

def stop_poller(join: bool = True, timeout: Optional[float] = None) -> None:
    """Stop background poller."""
    ev = get_stop_event()
    ev.set()
    if join and _thread:
        _thread.join(timeout=timeout or 0)

def is_poller_running() -> bool:
    """Check if poller thread is alive."""
    return bool(_thread and _thread.is_alive())

def get_thread() -> Optional[threading.Thread]:
    return _thread

def get_stop_event() -> threading.Event:
    global _stop_event
    if _stop_event is None:
        _stop_event = threading.Event()
    return _stop_event

# ---------------------------------------------------------------------
# Cursor (meta_data)
# ---------------------------------------------------------------------

CURSOR_KEY = "poll:contracts"  # stored shape: {"max_id_seen": int}

def load_max_id_seen_effective() -> int:
    """
    Read stored max_id_seen (or 0 if missing), then return:
      max(stored, (cfg.min_contract_id - 1))
    """
    cfg = _require_cfg()
    conn = _db.open_rw()
    try:
        obj = _db.casely_meta_get(conn, CURSOR_KEY) or {}
    finally:
        conn.close()
    stored = int(obj.get("max_id_seen", 0) or 0)
    min_id_minus_1 = int(cfg.min_contract_id) - 1
    return max(stored, min_id_minus_1)

def save_max_id_seen(new_max_id: int) -> None:
    """Advance cursor only after a successful batch."""
    conn = _db.open_rw()
    try:
        obj = _db.casely_meta_get(conn, CURSOR_KEY) or {}
        if int(obj.get("max_id_seen", 0) or 0) >= new_max_id:
            return
        obj["max_id_seen"] = int(new_max_id)
        _db.casely_meta_set(conn, CURSOR_KEY, obj)
    finally:
        conn.close()

# ---------------------------------------------------------------------
# AUTH (meta_data: key='auth')
# ---------------------------------------------------------------------

AUTH_KEY = "auth"  # stored shape: {"access_token": "...", "userId": "..."}

def load_auth() -> Optional[AuthInfo]:
    conn = _db.open_rw()
    try:
        obj = _db.casely_meta_get(conn, AUTH_KEY)
    finally:
        conn.close()
    if not obj:
        return None
    access_token = obj.get("access_token")
    user_id = obj.get("userId")
    if not access_token or not user_id:
        return None
    return AuthInfo(access_token=str(access_token), user_id=str(user_id))


def save_auth(access_token: str, user_id: str) -> None:
    global _auth_paused
    # 이미 저장된 값과 같으면 바로 return
    current = load_auth()
    if current and current.access_token == access_token and current.user_id == user_id:
        return
    log_message(f"[save_auth] new value: access_token={access_token}, user_id={user_id}")
    conn = _db.open_rw()
    try:
        _db.casely_meta_set(conn, AUTH_KEY, {"access_token": access_token, "userId": user_id})
    finally:
        conn.close()
    _auth_paused = False  # new token clears pause

def clear_auth() -> None:
    """Clear auth; subsequent polling cycles should PASS."""
    global _auth_paused
    conn = _db.open_rw()
    try:
        _db.casely_meta_set(conn, AUTH_KEY, {})
    finally:
        conn.close()
    _auth_paused = True

def notify_auth_status(status_code: int) -> None:
    """If status 209 received from origin, pause polling until new token arrives."""
    global _auth_paused
    if status_code == 209:
        _auth_paused = True

def is_auth_ready() -> bool:
    """Return True if we have token+user_id and are not paused due to 209."""
    if _auth_paused:
        return False
    info = load_auth()
    return bool(info and info.access_token and info.user_id)

# ---------------------------------------------------------------------
# Remote API adapters (POST using urllib)
# ---------------------------------------------------------------------

def _require_cfg() -> PollerConfig:
    if _cfg is None:
        raise RuntimeError("Poller config not initialized. Call init_poller(PollerConfig(...)) first.")
    return _cfg

def _base_url() -> str:
    base = _require_cfg().base_url.strip()
    if not base:
        raise RuntimeError("Poller base_url is empty.")
    return base.rstrip("/")

def _timeout() -> float:
    t = float(_require_cfg().http_timeout_s)
    return t if t > 0 else 10.0

def _http_post_json(url: str, payload: Dict[str, Any], timeout_s: float) -> Tuple[int, Optional[Any], str]:
    """
    POST JSON (standard library only). Return (status, parsed_json_or_None, raw_text).
    """
    data_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = _urlreq.Request(
        url=url,
        data=data_bytes,
        method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json, text/plain, */*",
        },
    )
    try:
        with _urlreq.urlopen(req, timeout=timeout_s) as resp:
            status = getattr(resp, "status", resp.getcode())
            raw = resp.read()
            text = raw.decode("utf-8", errors="replace")
    except HTTPError as e:
        status = e.code
        raw = e.read()
        text = raw.decode("utf-8", errors="replace") if raw else ""
    except URLError:
        # Network failure — represent as status 0, no JSON
        return (0, None, "")
    # Try parse JSON
    try:
        parsed = json.loads(text)
    except Exception:
        parsed = None
    return (status, parsed, text)

def _is_desired_item(raw_item: Dict[str, Any]) -> bool:
    """
    Business filter: keep only items where
      businessWorkDsticText ∈ {"매뉴얼", "규정지침 + 매뉴얼"}.
    """
    t = (raw_item or {}).get("businessWorkDsticText", "") or ""
    return t in ("매뉴얼", "규정지침 + 매뉴얼")

def make_list_payload(auth: AuthInfo, *, page: int, page_size: int) -> Dict[str, Any]:
    return {
        "_bak_t": auth.access_token,
        "schEpicId": -1,
        "checkData": {"teamTask": auth.user_id},
        "pageNum": int(page),
        "numberPerPage": int(page_size),
        "abroad": False,
        "filter": {},
        "tempMapObj": {
            "isAbroad": False,
            "isLawyer": False,
            "categoryId": 65,
            "sort": {"columnType": "viewCode", "order": "desc"},
            "status": "ALL",
        },
    }

def fetch_list_page(auth: AuthInfo, page: int, page_size: int) -> Tuple[List[RemoteListItem], bool]:
    """
    POST LIST_PATH and return (filtered_items, has_more).
    Response shape:
    { "returnCode": 0, "appData": { "contractList": [ { "id": 123, "businessWorkDsticText": "...", ... }, ... ] } }
    • Status 209 → notify_auth_status(209) and return ([], False).
    • has_more: True if raw contractList count >= page_size (heuristic).
    """
    start_cursor = load_max_id_seen_effective()

    url = f"{_base_url()}{LIST_PATH}"
    status, data, _ = _http_post_json(url, make_list_payload(auth, page=page, page_size=page_size), timeout_s=_timeout())
    if status == 209:
        notify_auth_status(209)
        return ([], False)

    items_raw: List[Dict[str, Any]] = []
    if isinstance(data, dict) and data.get("returnCode") == 0:
        app_data = data.get("appData") or {}
        lst = app_data.get("contractList")
        if isinstance(lst, list):
            items_raw = lst

    has_more = len(items_raw) >= page_size

    # Build filtered RemoteListItem list (LIST is assumed to be sorted by id DESC)
    items: List[RemoteListItem] = []
    for it in items_raw:
        if not isinstance(it, dict):
            continue
        
        cid = it.get("id")
        
        if cid <= start_cursor:
            has_more = False  # full stop (older pages unnecessary)
            break

        if not _is_desired_item(it):
            continue

        items.append(RemoteListItem(id=cid, meta=it))

    return (items, has_more)

def make_detail_payload(auth: AuthInfo, *, contract_id: int) -> Dict[str, Any]:
    return {
        "_bak_t": auth.access_token,
        "schEpicId": -1,
        "checkData": {"teamTask": auth.user_id},
        "contract": {"id": int(contract_id)},
    }

def make_chats_payload(auth: AuthInfo, *, contract_id: int) -> Dict[str, Any]:
    return {
        "_bak_t": auth.access_token,
        "schEpicId": -1,
        "checkData": {"teamTask": auth.user_id},
        "appType": "CONTRACT",
        "tempMap": {"entityId": int(contract_id)},
    }

def fetch_detail_and_chats(contract_id: int, auth: AuthInfo) -> Optional[DetailPayload]:
    """
    POST DETAIL_PATH / CHATS_PATH.
    - detail: use resp["appData"] as the payload
    - chats : use resp["appData"]["chatList"] as the payload
    - strip 'fileText' recursively before hashing/storing (detail only)
    - 209 → pause and return None
    """
    # detail
    d_url = f"{_base_url()}{DETAIL_PATH}"
    d_status, d_json, _ = _http_post_json(d_url, make_detail_payload(auth, contract_id=contract_id), timeout_s=_timeout())
    if d_status == 209:
        notify_auth_status(209)
        return None
    if not (isinstance(d_json, dict) and d_json.get("returnCode") == 0):
        return None
    detail_obj = (d_json.get("appData") or {})
    remove_filetext_fields(detail_obj)  # mutate in place
    detail_str = json.dumps(detail_obj, ensure_ascii=False, separators=(",", ":"))

    # chats
    c_url = f"{_base_url()}{CHATS_PATH}"
    c_status, c_json, _ = _http_post_json(c_url, make_chats_payload(auth, contract_id=contract_id), timeout_s=_timeout())
    if c_status == 209:
        notify_auth_status(209)
        return None
    if not (isinstance(c_json, dict) and c_json.get("returnCode") == 0):
        return None
    chats_list = (c_json.get("appData") or {}).get("chatList") or []
    if not isinstance(chats_list, list):
        chats_list = []
    chats_str = json.dumps(chats_list, ensure_ascii=False, separators=(",", ":"))

    return DetailPayload(
        detail_json_str=detail_str,
        chats_json_str=chats_str,
    )

# ---------------------------------------------------------------------
# Polling logic
# ---------------------------------------------------------------------

def now_ms() -> int:
    return int(time.time() * 1000)

def poll_pages_once(max_pages: Optional[int] = None) -> int:
    """
    LIST is sorted by id DESC.
    Batch flow:
      - At batch start: start_cursor = load_max_id_seen_effective()
      - During batch: DO NOT save cursor
      - For each item: stop if item.id <= start_cursor (already seen)
                       fetch detail+chats, then upsert-or-touch
      - At batch end: save_max_id_seen(batch_max_seen) if advanced
    Returns: number of stored items in this batch
    """
    cfg = _require_cfg()
    if not is_auth_ready():
        return 0
    auth = load_auth()
    if not auth:
        return 0

    start_cursor = load_max_id_seen_effective()
    batch_max_seen = start_cursor
    processed = 0
    page = 1
    pages_done = 0

    # open one RW connection for the whole batch
    conn = _db.open_rw()
    try:
        while True:
            items, has_more = fetch_list_page(auth, page, cfg.page_size)

            for it in items:
                payload = fetch_detail_and_chats(it.id, auth)
                if payload is None:
                    # start_cursor를 업데이트 해버리면 다시 fetch를 안하기 때문에 억울하지만 바로 리턴.
                    # 다음 fetch 때 첫페이지부터 다시 시작해야 함. :(
                    return processed

                # Upsert or touch (to be implemented in db.py)
                changed = _db.casely_upsert_fetched_contract(
                    conn,
                    id=it.id,
                    detail_json_str=payload.detail_json_str,
                    chats_json_str=payload.chats_json_str,
                    fetched_at_ms=now_ms(),
                )

                if changed:
                    log_message(f"[poll_pages_once] new or updated contract saved: id={it.id}")

                if it.id > batch_max_seen:
                    batch_max_seen = it.id

                processed += 1
                if cfg.sleep_between_items_s > 0:
                    time.sleep(cfg.sleep_between_items_s)

            pages_done += 1
            if not has_more:
                break

            page += 1
            if cfg.sleep_between_pages_s > 0:
                time.sleep(cfg.sleep_between_pages_s)
    finally:
        conn.close()

    # advance cursor only once, at batch end
    if batch_max_seen > start_cursor:
        save_max_id_seen(batch_max_seen)

    return processed

def refresh_stale_once(ttl_ms: int, max_items: Optional[int] = None) -> int:
    """
    TTL refresh:
      - Pick contracts where (now - fetched_at) > ttl_ms (oldest first, up to max_items)
      - Re-fetch detail+chats
      - If content changed: upsert-or-touch (which will set updated_at=now)
      - If content same: touch fetched_at ONLY
    Returns number of processed items.
    """
    cfg = _require_cfg()
    if not is_auth_ready():
        return 0
    auth = load_auth()
    if not auth:
        return 0

    older_than = now_ms() - int(ttl_ms)
    limit = max_items or cfg.page_size

    # needs helper in db.py
    conn = _db.open_rw()
    try:
        stale_ids = _db.casely_get_stale_contract_ids(conn, older_than_ms=older_than, limit=limit)
        count = 0
        for cid in stale_ids:
            payload = fetch_detail_and_chats(int(cid), auth)
            if payload is None:
                # e.g., 209 — stop early
                return count


            changed = _db.casely_upsert_fetched_contract(
                conn,
                id=int(cid),
                detail_json_str=payload.detail_json_str,
                chats_json_str=payload.chats_json_str,
                fetched_at_ms=now_ms(),
            )
            if changed:
                log_message(f"[refresh_stale_once] contract updated: id={cid}")
            else:
                # touch fetched_at only when unchanged
                _db.casely_touch_fetched_at(conn, id=int(cid), fetched_at_ms=now_ms())

            count += 1
            if cfg.sleep_between_items_s > 0:
                time.sleep(cfg.sleep_between_items_s)
        return count
    finally:
        conn.close()


def poll_forever() -> None:
    """
    Run batches until stop signal:
      1) If auth not ready or paused (209), sleep and continue
      2) Run poll_pages_once()
      3) If refresh_ttl_ms configured, run refresh_stale_once()
      4) Sleep a bit between cycles
      5) 매 루프마다 메시지 큐를 non-blocking으로 확인
    """
    cfg = _require_cfg()
    ev = get_stop_event()
    global _polling_queue
    # print("[poll_forever] PollerConfig:")
    # print(f"  base_url: {cfg.base_url}")
    # print(f"  page_size: {cfg.page_size}")
    # print(f"  sleep_between_items_s: {cfg.sleep_between_items_s} sec")
    # print(f"  sleep_between_pages_s: {cfg.sleep_between_pages_s} sec")
    # print(f"  http_timeout_s: {cfg.http_timeout_s} sec")
    # print(f"  min_contract_id: {cfg.min_contract_id}")
    # print(f"  refresh_ttl_ms: {cfg.refresh_ttl_ms} ms")
    while not ev.is_set():
        if _polling_queue is not None:
            msg = None
            while True:
                try:
                    msg = _polling_queue.get_nowait()
                except queue.Empty:
                    break
            if msg is not None:
                if msg.get("type") == "set_auth":
                    access_token = msg.get("access_token")
                    user_id = msg.get("userId")
                    if access_token and user_id:
                        save_auth(access_token, user_id)


        if not is_auth_ready():
            time.sleep(cfg.sleep_between_pages_s)
            continue

        # new items via LIST
        _ = poll_pages_once()

        # TTL refresh
        if cfg.refresh_ttl_ms:
            try:
                _ = refresh_stale_once(cfg.refresh_ttl_ms)
            except Exception as e:
                import traceback
                print("[poll_forever] Exception in refresh_stale_once:", e)
                traceback.print_exc()

        time.sleep(cfg.sleep_between_pages_s)

# ---------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------



def remove_filetext_fields(obj):
    if isinstance(obj, dict):
        obj.pop("fileText", None)
        for v in obj.values():
            remove_filetext_fields(v)
    elif isinstance(obj, list):
        for item in obj:
            remove_filetext_fields(item)
