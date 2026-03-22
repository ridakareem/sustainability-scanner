import os
from pymongo import MongoClient

_client = None
_db     = None


def get_db():
    global _client, _db
    if _db is None:
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/sustainability_scanner")
        _client   = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=3000,
            connectTimeoutMS=3000,
        )
        db_name = os.getenv("MONGO_DB_NAME", "sustainability_scanner")
        _db     = _client[db_name]
        # Indexes (idempotent)
        _db.products.create_index("barcode", unique=True, sparse=True)
        _db.products.create_index("name")
        _db.users.create_index("email", unique=True)
        _db.history.create_index([("user_id", 1), ("scanned_at", -1)])
    return _db
