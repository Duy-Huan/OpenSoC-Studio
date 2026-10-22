import hashlib
import json
import sqlite3
import threading
from pathlib import Path


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


class Store:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.blobs = self.root / 'artifacts'
        self.blobs.mkdir(exist_ok=True)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(self.root / 'studio.sqlite3', check_same_thread=False)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS documents(kind TEXT, id TEXT, project_id TEXT, body TEXT,
            PRIMARY KEY(kind,id));
          CREATE TABLE IF NOT EXISTS events(run_id TEXT, seq INTEGER, body TEXT,
            PRIMARY KEY(run_id,seq));
        ''')
        self.db.commit()

    def get(self, kind, identifier):
        with self.lock:
            row = self.db.execute('SELECT body FROM documents WHERE kind=? AND id=?', (kind, identifier)).fetchone()
        return json.loads(row[0]) if row else None

    def list(self, kind, project_id=None):
        with self.lock:
            if project_id is None:
                rows = self.db.execute('SELECT body FROM documents WHERE kind=? ORDER BY rowid DESC', (kind,)).fetchall()
            else:
                rows = self.db.execute('SELECT body FROM documents WHERE kind=? AND project_id=? ORDER BY rowid DESC', (kind, project_id)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def put(self, kind, identifier, value, project_id=None, immutable=False):
        with self.lock, self.db:
            if immutable:
                self.db.execute('INSERT INTO documents VALUES(?,?,?,?)', (kind, identifier, project_id, canonical(value)))
            else:
                self.db.execute('INSERT INTO documents VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body,project_id=excluded.project_id', (kind, identifier, project_id, canonical(value)))

    def append(self, run_id, kind, data):
        with self.lock, self.db:
            seq = self.db.execute('SELECT COALESCE(MAX(seq),0)+1 FROM events WHERE run_id=?', (run_id,)).fetchone()[0]
            event = {'schema_version': '1.0', 'run_id': run_id, 'seq': seq, 'kind': kind, 'data': data}
            self.db.execute('INSERT INTO events VALUES(?,?,?)', (run_id, seq, canonical(event)))
        return event

    def events(self, run_id, after=0, limit=500):
        with self.lock:
            rows = self.db.execute('SELECT body FROM events WHERE run_id=? AND seq>? ORDER BY seq LIMIT ?', (run_id, after, limit)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def blob(self, data: bytes):
        sha = digest(data)
        path = self.blobs / sha
        with self.lock:
            if not path.exists():
                with path.open('xb') as output:
                    output.write(data)
        return sha

    def close(self):
        self.db.close()
