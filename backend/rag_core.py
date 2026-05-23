from urllib.parse import parse_qs, urlparse


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


def normalize_transcript(transcript) -> list[dict]:
    """YouTube API objects → plain [{text, start}, ...] for UI + chunking."""
    lines = []
    for entry in transcript:
        text = entry["text"] if isinstance(entry, dict) else entry.text
        start = entry["start"] if isinstance(entry, dict) else entry.start
        text = str(text).replace("\n", " ").strip()
        if text:
            lines.append({"text": text, "start": float(start)})
    return lines


def chunk_transcript(transcript, chunk_size=300, overlap=50):
    """Split transcript into overlapping word windows for embedding/search."""
    words = []
    for entry in transcript:
        text = entry["text"] if isinstance(entry, dict) else entry.text
        start = float(entry["start"] if isinstance(entry, dict) else entry.start)
        for word in str(text).split():
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


def filter_ranked_chunks(ranked: list[dict], threshold: float) -> list[dict]:
    """Prefer matches above threshold; if none pass, keep top results anyway."""
    filtered = [c for c in ranked if c["score"] >= threshold]
    return filtered if filtered else ranked[:3]
