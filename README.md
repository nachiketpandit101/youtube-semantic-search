# YouTube Semantic Search

Ask questions about YouTube videos using semantic search and RAG. The app fetches captions, chunks and embeds them locally, stores vectors in Pinecone, retrieves relevant passages, and generates answers with Groq.

## Stack

- **Frontend:** React + Vite
- **Backend:** FastAPI
- **Embeddings:** `BAAI/bge-small-en-v1.5` (local, via sentence-transformers)
- **Vector DB:** Pinecone (384 dimensions, cosine metric)
- **LLM:** Groq (`llama-3.1-8b-instant` by default)

## Prerequisites

- Python 3.11+
- Node.js 18+
- Free accounts: [Pinecone](https://www.pinecone.io), [Groq](https://console.groq.com)

## Pinecone index

Create an index in the Pinecone console before running the app:

| Setting     | Value   |
|------------|---------|
| Dimensions | `384`   |
| Metric     | cosine  |

Use the same name in `PINECONE_INDEX_NAME` below. If you previously used OpenAI embeddings (1536 dims), create a new index and re-index videos.

## Environment variables

Create `backend/.env`:

```env
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=youtube-semantic-search
GROQ_API_KEY=your_groq_key

# Optional
GROQ_MODEL=llama-3.1-8b-instant
SCORE_THRESHOLD=0.35
```

Do not commit `.env` to git.

## Backend setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

pip install -r requirements.txt
uvicorn main:app --reload
```

API runs at `http://127.0.0.1:8000`. The first start downloads the embedding model (~130MB).

Check connectivity:

```bash
curl http://127.0.0.1:8000/health
```

## Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the backend on port 8000.

## Usage

1. Paste a YouTube URL with captions and click **Load video**.
2. Wait for indexing (transcript appears in the left panel).
3. Type a question and click **Ask**.
4. Read the answer and source chunks with timestamp links.
5. Use the **History** sidebar to switch between indexed videos instantly (no re-embedding).
6. Click **x** on a history item to delete its Pinecone namespace and remove it from history.

## API endpoints

| Method | Path          | Description                          |
|--------|---------------|--------------------------------------|
| GET    | `/health`     | Check embeddings, Pinecone, Groq key |
| POST   | `/transcript` | Fetch transcript, embed, upsert      |
| POST   | `/search`     | Semantic search only (no LLM)        |
| POST   | `/ask`        | RAG: search + Groq answer            |
| GET    | `/video-info` | Title and thumbnail for a URL        |
| GET    | `/videos/{id}/status` | Check if video is already indexed in Pinecone |
| DELETE | `/videos/{id}`| Delete Pinecone namespace for a video |

Example:

```bash
curl -X POST http://127.0.0.1:8000/transcript \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://www.youtube.com/watch?v=VIDEO_ID\"}"

curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"What is the main topic?\", \"video_id\": \"VIDEO_ID\"}"
```

## Troubleshooting

- **Backend unreachable:** Ensure `uvicorn` is running in `backend/` before using the UI.
- **No search results:** Re-load the video after changing indexes or thresholds. Lower `SCORE_THRESHOLD` if needed.
- **0 chunks indexed:** The video may have no captions; try another video.
- **Groq errors:** Confirm `GROQ_API_KEY` and free-tier limits at console.groq.com.

## Project layout

```
youtube-semantic-search/
  backend/          FastAPI app, main.py, requirements.txt
  frontend/         React UI, Vite dev server
```
