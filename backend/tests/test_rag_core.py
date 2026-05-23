import pytest

from rag_core import (
    chunk_transcript,
    extract_video_id,
    filter_ranked_chunks,
    normalize_transcript,
)
from tests.fixtures import (
    LOW_SCORE_RANKED,
    MIXED_SCORE_RANKED,
    NORMALIZED_TRANSCRIPT,
    RAW_TRANSCRIPT,
    SAMPLE_URLS,
    SAMPLE_VIDEO_ID,
)


class TestExtractVideoId:
    @pytest.mark.parametrize(
        "url_key",
        ["watch", "watch_with_params", "short", "short_www", "mobile"],
    )
    def test_parses_supported_youtube_urls(self, url_key: str):
        assert extract_video_id(SAMPLE_URLS[url_key]) == SAMPLE_VIDEO_ID

    def test_rejects_invalid_url(self):
        with pytest.raises(ValueError, match="Could not get video id"):
            extract_video_id(SAMPLE_URLS["invalid"])


class TestNormalizeTranscript:
    def test_normalizes_dict_entries_and_skips_empty_lines(self):
        assert normalize_transcript(RAW_TRANSCRIPT) == NORMALIZED_TRANSCRIPT

    def test_supports_object_like_entries(self):
        class Entry:
            def __init__(self, text: str, start: float):
                self.text = text
                self.start = start

        transcript = [Entry("spoken words", 4.5)]
        assert normalize_transcript(transcript) == [
            {"text": "spoken words", "start": 4.5},
        ]


class TestChunkTranscript:
    def test_builds_single_chunk_for_short_transcript(self):
        transcript = [{"text": "one two three four", "start": 0.0}]
        chunks = chunk_transcript(transcript, chunk_size=10, overlap=2)

        assert len(chunks) == 1
        assert chunks[0]["text"] == "one two three four"
        assert chunks[0]["start"] == 0.0

    def test_uses_overlapping_windows_for_long_transcript(self):
        words = " ".join(f"word{i}" for i in range(12))
        transcript = [{"text": words, "start": 7.0}]
        chunks = chunk_transcript(transcript, chunk_size=5, overlap=2)

        assert len(chunks) == 4
        assert chunks[0]["start"] == 7.0
        assert chunks[0]["text"].startswith("word0 word1")
        assert chunks[1]["text"].startswith("word3 word4")
        assert chunks[-1]["text"] == "word9 word10 word11"


class TestFilterRankedChunks:
    def test_returns_matches_above_threshold(self):
        result = filter_ranked_chunks(MIXED_SCORE_RANKED, threshold=0.35)

        assert len(result) == 2
        assert result[0]["text"] == "strong match"
        assert result[1]["text"] == "also strong"

    def test_falls_back_to_top_three_when_none_pass_threshold(self):
        result = filter_ranked_chunks(LOW_SCORE_RANKED, threshold=0.35)

        assert result == LOW_SCORE_RANKED[:3]
