# main.py

import asyncio

import os

from urllib.parse import parse_qs, urlparse



from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException

from fastapi.middleware.cors import CORSMiddleware

from pinecone import Pinecone

from sentence_transformers import SentenceTransformer

from youtube_transcript_api import YouTubeTranscriptApi



load_dotenv()


EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"

EMBEDDING_DIM = 384
BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "
print(f"Loading embedding model {EMBEDDING_MODEL_NAME} (first run downloads ~130MB)...")
embedder = SentenceTransformer(EMBEDDING_MODEL_NAME)
print("Embedding model ready.")



pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

index = pc.Index(os.getenv("PINECONE_INDEX_NAME", "youtube-search"))



SCORE_THRESHOLD = 0.75





def extract_video_id(url: str) -> str:

    """Pull the 11-char id from watch or youtu.be links."""

    parsed = urlparse(url.strip())



    if parsed.hostname in ("youtu.be", "www.youtu.be"):

        return parsed.path.lstrip("/").split("/")[0]



    if parsed.hostname and "youtube.com" in parsed.hostname:

        video_id = parse_qs(parsed.query).get("v", [None])[0]

        if video_id:

            return video_id



    raise ValueError(f"Could not get video id from: {url}")





def chunk_transcript(transcript, chunk_size=300, overlap=50):

    """

    Split a transcript into overlapping word windows for embedding/search.



    Each YouTube caption entry has text + start (seconds). We flatten all

    words while remembering which start time each word came from, then slice

    into chunks. overlap keeps ~50 words repeated between chunks so sentences

    split at a boundary still have context in at least one chunk.

    """

    words = []

    for entry in transcript:

        text = entry["text"] if isinstance(entry, dict) else entry.text

        start = entry["start"] if isinstance(entry, dict) else entry.start

        for word in text.split():

            words.append({"word": word, "start": start})



    chunks = []

    i = 0

    while i < len(words):

        chunk_words = words[i : i + chunk_size]

        if not chunk_words:

            break

        chunks.append(

            {

                "text": " ".join(w["word"] for w in chunk_words),

                "start": chunk_words[0]["start"],

            }

        )

        i += chunk_size - overlap

    return chunks





def _encode_texts(texts: list[str], *, is_query: bool) -> list[list[float]]:

    """

    Run the local model on a batch of strings.



    normalize_embeddings=True makes cosine similarity in Pinecone behave well.

    .tolist() converts numpy arrays to plain Python lists for Pinecone upsert.

    """

    if is_query:

        texts = [BGE_QUERY_PREFIX + t for t in texts]



    vectors = embedder.encode(texts, normalize_embeddings=True)

    return [vector.tolist() for vector in vectors]





def embed_text_sync(text: str, *, is_query: bool = False) -> list[float]:

    return _encode_texts([text], is_query=is_query)[0]





def embed_chunks_sync(chunks: list[dict]) -> list[dict]:

    if not chunks:

        return chunks



    texts = [c["text"] for c in chunks]

    embeddings = _encode_texts(texts, is_query=False)

    for chunk, embedding in zip(chunks, embeddings):

        chunk["embedding"] = embedding

    return chunks





async def embed_text(text: str, *, is_query: bool = False) -> list[float]:

    # encode() is CPU-bound; run in a thread so FastAPI stays responsive

    return await asyncio.to_thread(embed_text_sync, text, is_query=is_query)





async def embed_chunks(chunks: list[dict]) -> list[dict]:

    return await asyncio.to_thread(embed_chunks_sync, chunks)





def upsert_chunks(chunks: list[dict], video_id: str) -> int:

    """Store chunk embeddings in Pinecone, scoped to this video via namespace."""

    vectors = []

    for i, chunk in enumerate(chunks):

        vectors.append(

            {

                "id": f"{video_id}-{i}",

                "values": chunk["embedding"],  # list[float], 384 dims

                "metadata": {

                    "text": chunk["text"],

                    "start": chunk["start"],

                    "video_id": video_id,

                },

            }

        )



    if not vectors:

        return 0



    index.upsert(vectors=vectors, namespace=video_id)

    return len(vectors)





def _match_score(match) -> float:

    return float(match.score if hasattr(match, "score") else match["score"])





def _match_metadata(match) -> dict:

    meta = match.metadata if hasattr(match, "metadata") else match["metadata"]

    return dict(meta)





app = FastAPI()

app.add_middleware(

    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)





@app.get("/health")

async def health():

    """Check local embeddings + Pinecone (no OpenAI)."""

    checks: dict = {}

    errors: list[str] = []



    try:

        vector = await embed_text("connection test", is_query=False)

        dim = len(vector)

        if dim != EMBEDDING_DIM:

            raise ValueError(f"Expected {EMBEDDING_DIM} dims, got {dim}")

        checks["embeddings"] = {

            "ok": True,

            "model": EMBEDDING_MODEL_NAME,

            "dimensions": dim,

        }

    except Exception as exc:

        checks["embeddings"] = {"ok": False, "error": str(exc)}

        errors.append(f"embeddings: {exc}")



    index_name = os.getenv("PINECONE_INDEX_NAME", "youtube-search")

    if not os.getenv("PINECONE_API_KEY"):

        checks["pinecone"] = {"ok": False, "error": "PINECONE_API_KEY not set in .env"}

        errors.append("pinecone: missing PINECONE_API_KEY")

    else:

        try:

            stats = index.describe_index_stats()

            checks["pinecone"] = {

                "ok": True,

                "index": index_name,

                "expected_dimensions": EMBEDDING_DIM,

                "total_vectors": stats.get("total_vector_count", 0),

                "namespaces": stats.get("namespaces", {}),

            }

        except Exception as exc:

            checks["pinecone"] = {"ok": False, "error": str(exc)}

            errors.append(f"pinecone: {exc}")



    return {"ok": len(errors) == 0, "checks": checks, "errors": errors}





@app.post("/transcript")

async def get_transcript(body: dict):

    url = body.get("url")

    if not url:

        raise HTTPException(status_code=400, detail="url is required")



    try:

        video_id = extract_video_id(url)

        ytt_api = YouTubeTranscriptApi()

        transcript = ytt_api.fetch(video_id)

        chunks = chunk_transcript(transcript)

        chunks = await embed_chunks(chunks)

        upserted = upsert_chunks(chunks, video_id)

    except ValueError as exc:

        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except Exception as exc:

        raise HTTPException(

            status_code=502,

            detail=f"Transcript/index failed: {exc}",

        ) from exc



    return {

        "video_id": video_id,

        "chunk_count": upserted,

        "indexed": True,

        "embedding_model": EMBEDDING_MODEL_NAME,

        "dimensions": EMBEDDING_DIM,

    }





@app.post("/search")

async def search(body: dict):

    question = body.get("question")

    video_id = body.get("video_id")

    if not question or not video_id:

        raise HTTPException(

            status_code=400,

            detail="question and video_id are required",

        )



    try:

        # is_query=True applies the BGE query prefix for better retrieval

        question_embedding = await embed_text(question, is_query=True)

        results = index.query(

            vector=question_embedding,

            top_k=5,

            include_metadata=True,

            namespace=video_id,

        )

    except Exception as exc:

        raise HTTPException(status_code=502, detail=f"Search failed: {exc}") from exc



    matches = results.matches if hasattr(results, "matches") else results["matches"]

    filtered = []

    for match in matches:

        score = _match_score(match)

        if score < SCORE_THRESHOLD:

            continue

        meta = _match_metadata(match)

        filtered.append(

            {

                "text": meta["text"],

                "start": meta["start"],

                "score": round(score, 4),

            }

        )



    return {

        "results": filtered,

        "threshold": SCORE_THRESHOLD,

        "total_matches": len(matches),

    }





def main():

    return 0





if __name__ == "__main__":

    main()

