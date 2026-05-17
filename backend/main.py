# main.py
from urllib.parse import parse_qs, urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from youtube_transcript_api import YouTubeTranscriptApi


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

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/transcript")
def get_transcript(body: dict):
    video_id = extract_video_id(body) 
    ytt_appi = YouTubeTranscriptApi()
    transcript = ytt_appi.fetch(video_id)
    return {"transcript": transcript, "video_id": video_id}

def main():
  print(get_transcript("https://www.youtube.com/watch?v=vztTLzRXCSw"))
  return 0

if __name__ == "__main__":
  main()
