## Project Info

This project converts CMS JSON exports into Qdrant-ready vectors and exposes both a web UI and an API to run the Python-based embedding pipeline.

**Deployed**: https://capitol-ai-assessment.onrender.com/

## Prerequisites
- Node.js 20+ and npm
- Python 3.10+ (for running `server/src/pipeline.py`)
- Git (to clone the repo)
- OpenAI API key (if you want OpenAI embeddings)
- Qdrant URL/API key (optional; only if you want to push vectors to Qdrant)

## Setup & Installation 

### Option 1 
Run `server/src/pipeline.py` independently to transform documents and optionally upload them to Qdrant.

**Setup**
```sh
# Clone the repo and enter it
git clone <your_repo_url>
cd capitol-ai-assessment

# Create your local env file
cp server/.env.example server/.env
# Open server/.env and fill in your keys (OPENAI_API_KEY, QDRANT_URL, QDRANT_API_KEY)

# Set up 
cd server/src
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt

# Run transformation
# OpenAI embeddings 
python pipeline.py --input path/to/raw.json --output output/qdrant_documents.json --provider openai --openai-model text-embedding-3-small

# Skip embeddings entirely
python pipeline.py --input path/to/raw.json --output output/qdrant_documents.json --skip-embeddings

# Limit number of documents processed
python pipeline.py --input path/to/raw.json --output output/qdrant_documents.json --limit 10
```
**Configuration Details**
- Copy `server/.env.example` to `server/.env` after cloning.
- Fill in your own `OPENAI_API_KEY`, `QDRANT_URL`, and `QDRANT_API_KEY` (or leave Qdrant values empty to skip upload).


### Option 2
A fully deployed live web application that lets users upload CMS documents and convert them into Qdrant-formatted JSON through a browser-based interface.

**Use Web Application**
1. Open https://capitol-ai-assessment.onrender.com/
2. Drag and drop your file into the **“CMS → Qdrant Converter”** box, or click **“Browse Files”** to upload it
3. Once processing is complete, download the converted JSON output

**Infrastructure Details**
- Hosted on Render using `Dockerfile` 
- Node/Express API listens on `PORT` (default 4000) and serves the built React app plus the `/api/pipeline` endpoint
- Python virtualenv is created inside the container to run `server/src/pipeline.py` 

## Assumptions
- Raw CMS `content_elements` may include images, tables, embeds, etc.; only `type === "text"` elements are extracted for embeddings.
- Documents should include canonical metadata (IDs, URLs, publish dates) in expected fields; missing/invalid timestamps are skipped with warnings

## Technologies Used

**Frontend is built with:**
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

**Backend is built with:**
- Node.js + Express
- TypeScript
- Python 3 (for the `pipeline.py` embedding/transformation script)

## Known Limitations
- In-memory cache only: the `documents` array resets on restart (Qdrant vectors persist, but the API doesn’t reload them)
- HTML stripping is basic: nested/complex tags may lose structure
- No handling for very long documents (>10K tokens) beyond embedding provider limits
- Large batches (1000+ docs) may need memory/throughput tuning or chunking
- No authentication/authorization on API or UI
- No automated tests or CI included

## Future Improvements
- Add auth and rate limiting to API endpoints
- Provide structured logging and better error reporting for pipeline runs
- Add unit/integration tests and CI workflow
- Add configurable retries/backoff for OpenAI/Qdrant calls
- Expose a background job/queue for large uploads and progress tracking

## Design Decisions
- **Text extraction:** Concatenate text content blocks and strip HTML tags for clean embeddings
  - Trade-off: formatting/structure is lost for nested or rich markup
- **In-memory cache on API:** API retains the last transformed docs for quick fetch
  - Trade-off: state resets on restart and does not auto-sync with Qdrant
- **Embedding provider:** Default to OpenAI embeddings (`text-embedding-3-small`) for quality and hosted scalability
  - Trade-off: requires paid API key and incurs external latency; SentenceTransformers remains available for offline use
- **Vector store:** Qdrant chosen for similarity search and simple cloud/SaaS hosting with cosine distance
  - Trade-off: adds an external dependency; upload is skipped when `QDRANT_URL`/`QDRANT_API_KEY` are unset
- **Single container deploy:** Dockerfile builds the Vite frontend and serves it from Express for a single Render service
  - Trade-off: frontend and API share a release cycle and image size increases
- **Environment-driven behavior:** Embedding provider, skip/limit toggles, and Qdrant upload are controlled via env vars for flexibility
  - Trade-off: misconfigured envs can cause silent skips or failures

## API Documentation

- **GET `/health`**  
  - Purpose: liveness check.  
  - Response: `200 OK` → `{ "status": "ok" }`

- **GET `/api/documents`**  
  - Purpose: fetch the last transformed documents held in memory.  
  - Response: `200 OK` → array of documents.

- **POST `/api/documents`**  
  - Purpose: replace the in-memory documents with your payload.  
  - Body: JSON array of documents `{ text, embedding?, metadata }`.  
  - Responses: `201 Created` → `{ stored: <count> }`; `400` if body is not an array.
  - Note: UI reads via `GET /api/documents`; it does not call this endpoint. 

- **POST `/api/pipeline`**  
  - Purpose: run `pipeline.py` on an array of CMS documents, optionally generating embeddings and uploading to Qdrant.  
  - Body: JSON array of raw CMS documents.  
  - Env-driven behavior:
    - `PIPELINE_SKIP_EMBEDDINGS=false` → generate embeddings; otherwise skip.
    - `PIPELINE_PROVIDER=openai|sentence-transformers` → choose embedding backend.
    - `QDRANT_URL`, `QDRANT_API_KEY` → if set, upload vectors to Qdrant; otherwise skip upload.  
  - Responses: `201 Created` → `{ stored, outputPath, message, documents }`; `400` if body is not an array; `500` on pipeline failure.
