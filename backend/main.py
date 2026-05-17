# main.py
import os
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from youtube_transcript_api import YouTubeTranscriptApi

load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
EMBEDDING_MODEL = "text-embedding-3-small"


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


async def embed_text(text: str) -> list[float]:
    response = await client.embeddings.create(
        input=text,
        model=EMBEDDING_MODEL,
    )
    return response.data[0].embedding


async def embed_chunks(chunks: list[dict]) -> list[dict]:
    if not chunks:
        return chunks

    texts = [c["text"] for c in chunks]
    response = await client.embeddings.create(input=texts, model=EMBEDDING_MODEL)
    for i, chunk in enumerate(chunks):
        chunk["embedding"] = response.data[i].embedding
    return chunks


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/transcript")
async def get_transcript(body: dict):
    video_id = extract_video_id(body["url"])
    ytt_api = YouTubeTranscriptApi()
    transcript = ytt_api.fetch(video_id)
    chunks = chunk_transcript(transcript)
    chunks = await embed_chunks(chunks)
    return {"video_id": video_id, "chunk_count": len(chunks), "chunks": chunks}


def main():
  return 0

if __name__ == "__main__":
  main()
