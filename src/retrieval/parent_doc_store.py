import sqlite3
import os
from contextlib import contextmanager

class ParentDocStore:
    def __init__(self, db_path: str = "Databases/parent_doc_store.db"):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self):
        # Create directory if db is nested
        db_dir = os.path.dirname(self.db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS parent_child_map (
                    child_id TEXT PRIMARY KEY,
                    child_text TEXT,
                    parent_id TEXT,
                    parent_text TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def store(self, child_id: str, child_text: str, parent_id: str, parent_text: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO parent_child_map 
                (child_id, child_text, parent_id, parent_text)
                VALUES (?, ?, ?, ?)
            """, (child_id, child_text, parent_id, parent_text))
            conn.commit()

    def expand_to_parent(self, child_id: str) -> str:
        """
        Called after retrieval — returns wider parent context for LLM.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT parent_text FROM parent_child_map WHERE child_id = ?", (child_id,))
            result = cursor.fetchone()
            
            if result:
                return result[0]
            return ""

    def get_child_text(self, child_id: str) -> str:
        """Helper for testing: fetches just the child text."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT child_text FROM parent_child_map WHERE child_id = ?", (child_id,))
            result = cursor.fetchone()
            
            if result:
                return result[0]
            return ""
