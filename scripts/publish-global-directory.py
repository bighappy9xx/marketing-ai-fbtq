#!/usr/bin/env python3
"""Publish the display-only projection of a full Bàn Hồ Sơ CSV export."""
import csv
import getpass
import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

HOST = "https://mediafbtq-6e1bb.web.app"
PROJECT = "mediafbtq-6e1bb"
DATABASE = f"projects/{PROJECT}/databases/(default)"
FIRESTORE = "https://firestore.googleapis.com/v1/" + DATABASE
STATUSES = {"Sẵn sàng", "Cần kiểm tra", "Tạm dừng", "Chưa đăng nhập", "Cần xác minh"}
COLUMNS = {"Hồ sơ": ("title", 100), "Tên hiển thị": ("displayName", 100),
           "Nhóm": ("group", 80), "Trạng thái": ("status", 30)}
LIMIT = 200


def read_directory(path):
    if path.stat().st_size > 4 * 1024 * 1024:
        raise ValueError("Tệp CSV vượt quá 4 MB.")
    with path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames != ["ID", "Hồ sơ", "Tên hiển thị", "UID", "Trạng thái", "Nhóm", "Ghi chú"]:
            raise ValueError("Chọn tệp CSV xuất trực tiếp từ Bàn Hồ Sơ.")
        records = {}
        for line, row in enumerate(reader, 2):
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"Dòng {line} không đúng cấu trúc CSV.")
            identifier = row["ID"].strip()
            entry = {key: row[column].strip() for column, (key, _) in COLUMNS.items()}
            if not identifier or not entry["title"] or entry["status"] not in STATUSES or any(
                len(entry[key]) > size for key, size in COLUMNS.values()
            ):
                raise ValueError(f"Dòng {line} thiếu tên hồ sơ hoặc có trường hiển thị không hợp lệ.")
            key = hashlib.sha256(identifier.encode("utf-8")).hexdigest()
            if key in records:
                raise ValueError(f"Dòng {line} trùng mã hồ sơ.")
            records[key] = entry
            if len(records) > LIMIT:
                raise ValueError(f"Mỗi danh sách tối đa {LIMIT} hồ sơ.")
        return records


def request(url, payload=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = json.dumps(payload).encode() if payload is not None else None
    with urlopen(Request(url, data=body, headers=headers), timeout=25) as response:
        return json.load(response)


def sign_in(email, password):
    with urlopen(HOST + "/firebase-config.js", timeout=20) as response:
        config = response.read(100_000).decode()
    key = re.search(r'apiKey\s*:\s*"([A-Za-z0-9_-]+)"', config)
    if not key:
        raise ValueError("Chưa đọc được cấu hình Firebase của FBTQ.")
    auth = request("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="
                   + quote(key[1]), {"email": email, "password": password, "returnSecureToken": True})
    return auth["localId"], auth["idToken"]


def publish(records, uid, token):
    collection = f"users/{uid}/globalDirectory"
    previous = request(f"{FIRESTORE}/documents/{collection}?pageSize={LIMIT + 1}", token=token)
    documents = previous.get("documents", [])
    if previous.get("nextPageToken") or len(documents) > LIMIT:
        raise ValueError("Danh sách Firebase vượt giới hạn đồng bộ.")
    old = {doc["name"].rsplit("/", 1)[-1]: doc for doc in documents}
    writes = [
        {"update": {"name": f"{DATABASE}/documents/{collection}/{key}",
                    "fields": {name: {"stringValue": value} for name, value in row.items()}},
         "currentDocument": {"updateTime": old[key]["updateTime"]} if key in old else {"exists": False}}
        for key, row in records.items()
    ]
    writes.extend({"delete": doc["name"], "currentDocument": {"updateTime": doc["updateTime"]}}
                  for key, doc in old.items() if key not in records)
    if writes:
        request(FIRESTORE + "/documents:commit", {"writes": writes}, token)


def main():
    if len(sys.argv) != 2 or not sys.stdin.isatty():
        raise ValueError('Chạy trong Terminal hoặc PowerShell. Cú pháp: python publish-global-directory.py "danh-sach.csv"')
    records = read_directory(Path(sys.argv[1]).expanduser())
    print(f"Sắp thay toàn bộ danh sách hiển thị trên FBTQ bằng {len(records)} hồ sơ từ CSV.")
    if input("Gõ DONG BO để tiếp tục: ").strip() != "DONG BO":
        return
    email = input("Email FBTQ: ").strip()
    password = getpass.getpass("Mật khẩu FBTQ: ")
    uid, token = sign_in(email, password)
    publish(records, uid, token)
    print(f"Đã đồng bộ {len(records)} hồ sơ. Mở Tài Nguyên Global trên website FBTQ.")


if __name__ == "__main__":
    try:
        main()
    except HTTPError as error:
        print(f"Firebase từ chối yêu cầu (HTTP {error.code}). Kiểm tra quyền FBTQ hoặc thử lại nếu danh sách vừa thay đổi.", file=sys.stderr)
        sys.exit(1)
    except URLError:
        print("Không kết nối được Firebase.", file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, KeyError, csv.Error) as error:
        print("Chưa đồng bộ: " + str(error), file=sys.stderr)
        sys.exit(1)
