import datetime
from flask import Blueprint, jsonify, request
from db import get_db
from scoring import calculate_score
from services.fetcher import fetch_by_barcode, search_by_name
from services.auth_service import optional_token

products_bp = Blueprint("products", __name__)


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if "cached_at" in doc and hasattr(doc["cached_at"], "isoformat"):
        doc["cached_at"] = doc["cached_at"].isoformat()
    return doc


def _get_or_fetch(barcode: str):
    db     = get_db()
    cached = db.products.find_one({"barcode": barcode})
    if cached:
        return _serialize(cached)

    product = fetch_by_barcode(barcode)
    if not product:
        return None

    is_food = product.get("is_food", True)
    product["sustainability"] = calculate_score(product, is_food)
    product["cached_at"]      = datetime.datetime.utcnow()

    try:
        db.products.update_one(
            {"barcode": barcode},
            {"$set": product},
            upsert=True,
        )
    except Exception:
        pass

    return _serialize(product)


@products_bp.route("/barcode/<barcode>", methods=["GET"])
@optional_token
def get_by_barcode(barcode):
    product = _get_or_fetch(barcode)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    if request.user_id and product.get("name"):
        db = get_db()
        db.history.insert_one({
            "user_id":    request.user_id,
            "barcode":    barcode,
            "name":       product.get("name", ""),
            "image_url":  product.get("image_url", ""),
            "score":      (product.get("sustainability") or {}).get("score"),
            "grade":      (product.get("sustainability") or {}).get("grade"),
            "scanned_at": datetime.datetime.utcnow(),
        })

    return jsonify(product)


@products_bp.route("/search", methods=["GET"])
def search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Missing query parameter 'q'"}), 400

    db = get_db()

    # Try cache first
    cached = list(db.products.find(
        {"name": {"$regex": query, "$options": "i"}},
        limit=10,
    ))
    if cached:
        return jsonify([_serialize(p) for p in cached])

    # Fetch from external APIs
    products = search_by_name(query)
    saved    = []
    for p in products:
        if not p.get("name"):
            continue
        is_food = p.get("is_food", True)
        p["sustainability"] = calculate_score(p, is_food)
        p["cached_at"]      = datetime.datetime.utcnow()
        if p.get("barcode"):
            try:
                db.products.update_one(
                    {"barcode": p["barcode"]},
                    {"$set": p},
                    upsert=True,
                )
            except Exception:
                pass
        saved.append(_serialize(p))

    if not saved:
        return jsonify({"error": "No products found"}), 404

    return jsonify(saved)


@products_bp.route("/<barcode>/alternatives", methods=["GET"])
def alternatives(barcode):
    db      = get_db()
    product = db.products.find_one({"barcode": barcode})
    if not product:
        return jsonify([])

    categories    = product.get("categories_tags") or []
    current_score = (product.get("sustainability") or {}).get("score", 0)

    if not categories:
        return jsonify([])

    alts = list(db.products.find(
        {
            "barcode":             {"$ne": barcode},
            "categories_tags":     {"$in": categories},
            "sustainability.score": {"$gt": current_score},
        },
        limit=5,
        sort=[("sustainability.score", -1)],
    ))

    return jsonify([_serialize(a) for a in alts])
