import argparse
import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from bs4 import BeautifulSoup
from qdrant_client import QdrantClient, models
from openai import OpenAI
from sentence_transformers import SentenceTransformer


logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

# Goal: if article text contains HTML, remove tags and keep the words
def strip_html(raw: Optional[str]) -> str:
    if not raw:
        return ""
    raw_str = str(raw)
    # If text doesn't contain HTML, return the text as is
    if "<" not in raw_str and "&" not in raw_str:
        return raw_str
    # Else, BeautifulSoup extracts plain text 
    return BeautifulSoup(raw_str, "html.parser").get_text(separator="\n")

# Goal: make text consistent and readable
def normalize_text(text: str) -> str:
    if text is None:
        return ""
    # Replaces NBSP in text with a normal space
    text = text.replace("\xa0", " ")
    text = strip_html(text)
    # Clean spaces around newlines
    text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
    # Drop leading/trailing newlines
    return text.strip("\n")

# Goal: if there are tags like ["news", "sports", "news"], keep only the first "news"
def dedupe_preserve(seq: Iterable[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for item in seq:
        if not item:
            continue
        if item not in seen:
            seen.add(item)
            ordered.append(item)
    return ordered


def extract_text(content_elements: Optional[List[Dict[str, Any]]]) -> str:
    if not content_elements:
        return ""

    segments: List[str] = []
    for elem in content_elements:
        etype = elem.get("type")
        if etype == "text":
            segments.append(elem.get("content", ""))

    cleaned = []
    for seg in segments:
        normalized = normalize_text(seg)
        if normalized:
            cleaned.append(normalized)
            
    # Combine cleaned segments with spaces between them
    combined = ""
    for part in cleaned:
        if not combined:
            combined = part
        else:
            combined += " " + part
    return combined


def collect_names(items: Iterable[Dict[str, Any]]) -> List[str]:
    names: List[str] = []
    for item in items:
        for key in ("name", "text", "description", "slug"):
            val = item.get(key)
            if val:
                names.append(val)
                break
    return names


def build_url(doc: Dict[str, Any]) -> Optional[str]:
    candidate = doc.get("canonical_url") or doc.get("website_url")
    website = doc.get("canonical_website") or doc.get("website")
    if not candidate:
        return None
    if candidate.startswith("http"):
        return candidate
    if website:
        return f"https://www.{website}.com{candidate}"
    return candidate


def extract_metadata(doc: Dict[str, Any]) -> Dict[str, Any]:
    taxonomy = doc.get("taxonomy") or {}
    # Build sections, categories, tags
    sections = dedupe_preserve(collect_names(taxonomy.get("sections") or []))
    categories = dedupe_preserve(collect_names(taxonomy.get("categories") or []))
    tags = dedupe_preserve(
        tag.lstrip("@")
        for tag in collect_names(taxonomy.get("tags") or [])
    )

    thumb = None
    promo = doc.get("promo_items") or {}
    for key in ("basic", "lead_art", "square1x1"):
        if key in promo and promo[key].get("url"):
            thumb = promo[key]["url"]
            break
    metadata: Dict[str, Any] = {}

    title = (doc.get("headlines") or {}).get("basic")
    if isinstance(title, str) and title.strip():
        metadata["title"] = title

    metadata["url"] = build_url(doc)
    metadata["external_id"] = doc.get("_id")

    publish_date = doc.get("publish_date")
    if isinstance(publish_date, str) and publish_date.strip():
        metadata["publish_date"] = publish_date

    display_date = doc.get("display_date") or doc.get("publish_date")
    if isinstance(display_date, str) and display_date.strip():
        metadata["datetime"] = display_date

    first_publish = doc.get("first_publish_date")
    if isinstance(first_publish, str) and first_publish.strip():
        metadata["first_publish_date"] = first_publish

    website = doc.get("canonical_website") or doc.get("website")
    if isinstance(website, str) and website.strip():
        metadata["website"] = website

    metadata["sections"] = sections or []
    metadata["categories"] = categories or []
    metadata["tags"] = tags or []

    if isinstance(thumb, str) and thumb.strip():
        metadata["thumb"] = thumb

    return metadata


def transform_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    text = extract_text(doc.get("content_elements"))
    metadata = extract_metadata(doc)
    return {"text": text, "metadata": metadata}


def validate_output(doc: Dict[str, Any], embedding_dim: Optional[int] = None) -> None:
    if not isinstance(doc.get("text"), str) or not doc["text"].strip():
        raise ValueError("Invalid text field")
    md = doc.get("metadata", {})
    for key in ("external_id", "url"):
        if not md.get(key):
            raise ValueError(f"Missing required metadata.{key}")
    for ts_key in ("publish_date", "datetime", "first_publish_date"):
        ts_val = md.get(ts_key)
        if ts_val is None:
            continue
        if not isinstance(ts_val, str):
            raise ValueError(f"metadata.{ts_key} must be string in ISO 8601 UTC format YYYY-MM-DDTHH:MM:SS[.fff]Z")
        if not ts_val.endswith("Z"):
            raise ValueError(f"metadata.{ts_key} must end with Z (UTC)")
        try:
            datetime.fromisoformat(ts_val.replace("Z", "+00:00"))
        except Exception:
            raise ValueError(f"metadata.{ts_key} must match ISO 8601 UTC format YYYY-MM-DDTHH:MM:SS[.fff]Z")
    if embedding_dim and "embedding" in doc:
        emb = doc["embedding"]
        if not isinstance(emb, list) or len(emb) != embedding_dim:
            raise ValueError("Embedding dimension mismatch")


def add_embeddings_sentence_transformers(docs: List[Dict[str, Any]], model_name: str) -> int:
    model = SentenceTransformer(model_name)
    dim = model.get_sentence_embedding_dimension()
    texts = [doc["text"] for doc in docs]
    embeddings = model.encode(texts, batch_size=8, show_progress_bar=True)
    for doc, emb in zip(docs, embeddings):
        doc["embedding"] = emb.tolist()
        validate_output(doc, embedding_dim=dim)
    return dim


def add_embeddings_openai(docs: List[Dict[str, Any]], model_name: str, batch_size: int = 100) -> int:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")
    client = OpenAI(api_key=api_key)
    texts = [doc["text"] for doc in docs]
    embeddings: List[List[float]] = []
    for start in range(0, len(texts), batch_size):
        batch = texts[start:start + batch_size]
        response = client.embeddings.create(model=model_name, input=batch)
        # Ensure ordering matches input using index
        batch_embeddings: List[List[float]] = [None] * len(response.data)  # type: ignore
        for item in response.data:
            batch_embeddings[item.index] = item.embedding  # type: ignore
        embeddings.extend(batch_embeddings)

    if not embeddings:
        raise ValueError("No embeddings returned from OpenAI")
    dim = len(embeddings[0])
    for doc, emb in zip(docs, embeddings):
        doc["embedding"] = emb
        validate_output(doc, embedding_dim=dim)
    return dim


def push_to_qdrant(docs: List[Dict[str, Any]], vector_size: int) -> None:
    """Upsert documents into a Qdrant collection using env configuration."""
    url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY")
    collection = os.getenv("QDRANT_COLLECTION", "documents")

    if not url or not api_key:
        logging.info("QDRANT_URL or QDRANT_API_KEY not set; skipping Qdrant upload.")
        return

    client = QdrantClient(url=url, api_key=api_key)

    client.recreate_collection(
        collection_name=collection,
        vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
    )

    points = []
    for idx, doc in enumerate(docs):
        # Qdrant requires point IDs to be UUIDs or unsigned ints; use index to avoid format issues.
        points.append(
            models.PointStruct(
                id=idx,
                vector=doc["embedding"],
                payload={**doc["metadata"], "text": doc["text"]},
            )
        )

    client.upsert(collection_name=collection, points=points)
    logging.info("Upserted %s vectors into Qdrant collection '%s'", len(points), collection)


def run_pipeline(
    input_path: Path,
    output_path: Path,
    limit: Optional[int],
    model_name: str,
    skip_embeddings: bool,
    provider: str,
    openai_model: str,
) -> None:
    # Read input file
    raw = json.loads(input_path.read_text())
    if limit:
        raw = raw[:limit]

    transformed: List[Dict[str, Any]] = []
    for doc in raw:
        try:
            transformed_doc = transform_document(doc)
            validate_output(transformed_doc)
            transformed.append(transformed_doc)
        except Exception as exc:
            logging.warning("Skipping doc %s: %s", doc.get("_id"), exc)

    embedding_dim: Optional[int] = None
    embedding_model_used: Optional[str] = None
    if not skip_embeddings:
        if provider == "openai":
            embedding_dim = add_embeddings_openai(transformed, openai_model)
            embedding_model_used = openai_model
        else:
            embedding_dim = add_embeddings_sentence_transformers(transformed, model_name)
            embedding_model_used = model_name
        logging.info("Embeddings generated with dimension %s", embedding_dim)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(transformed, indent=2, ensure_ascii=False))
    logging.info("Wrote %s documents to %s", len(transformed), output_path)
    if embedding_dim:
        logging.info("Embedding provider=%s model=%s dim=%s", provider, embedding_model_used, embedding_dim)
        push_to_qdrant(transformed, embedding_dim)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Transform raw CMS data to Qdrant format.")
    parser.add_argument("--input", type=Path, default=Path("data/raw_customer_api.json"))
    parser.add_argument("--output", type=Path, default=Path("output/qdrant_documents.json"))
    parser.add_argument("--limit", type=int, help="Limit documents processed.")
    parser.add_argument(
        "--model",
        type=str,
        default="sentence-transformers/all-MiniLM-L6-v2",
        help="SentenceTransformers model name (used when provider=sentence-transformers).",
    )
    parser.add_argument(
        "--provider",
        choices=["sentence-transformers", "openai"],
        default="openai",
        help="Embedding provider to use.",
    )
    parser.add_argument(
        "--openai-model",
        type=str,
        default="text-embedding-3-small",
        help="OpenAI embedding model name (used when provider=openai).",
    )
    parser.add_argument("--skip-embeddings", action="store_true", help="Skip embedding generation.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_pipeline(
        input_path=args.input,
        output_path=args.output,
        limit=args.limit,
        model_name=args.model,
        skip_embeddings=args.skip_embeddings,
        provider=args.provider,
        openai_model=args.openai_model,
    )
