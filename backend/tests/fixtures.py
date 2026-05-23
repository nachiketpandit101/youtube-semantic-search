SAMPLE_VIDEO_ID = "dQw4w9WgXcQ"

SAMPLE_URLS = {
    "watch": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "watch_with_params": "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    "short": "https://youtu.be/dQw4w9WgXcQ",
    "short_www": "https://www.youtu.be/dQw4w9WgXcQ",
    "mobile": "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "invalid": "https://example.com/not-youtube",
}

RAW_TRANSCRIPT = [
    {"text": "Hello world", "start": 0.0},
    {"text": "Second line", "start": 1.5},
    {"text": "", "start": 2.0},
    {"text": "Line\nwith break", "start": 3.0},
]

NORMALIZED_TRANSCRIPT = [
    {"text": "Hello world", "start": 0.0},
    {"text": "Second line", "start": 1.5},
    {"text": "Line with break", "start": 3.0},
]

LOW_SCORE_RANKED = [
    {"text": "weak match", "start": 10.0, "score": 0.12},
    {"text": "another weak", "start": 20.0, "score": 0.08},
    {"text": "third weak", "start": 30.0, "score": 0.05},
    {"text": "fourth weak", "start": 40.0, "score": 0.02},
]

MIXED_SCORE_RANKED = [
    {"text": "strong match", "start": 5.0, "score": 0.82},
    {"text": "below threshold", "start": 15.0, "score": 0.21},
    {"text": "also strong", "start": 25.0, "score": 0.67},
    {"text": "weak tail", "start": 35.0, "score": 0.09},
]
