from unittest.mock import AsyncMock, MagicMock

import pytest

import main
from tests.fixtures import LOW_SCORE_RANKED, MIXED_SCORE_RANKED


@pytest.mark.asyncio
async def test_search_chunks_uses_threshold_filter(monkeypatch):
    monkeypatch.setattr(main, "SCORE_THRESHOLD", 0.35)
    monkeypatch.setattr(main, "embed_text", AsyncMock(return_value=[0.1] * 384))

    matches = [
        MagicMock(score=item["score"], metadata=item)
        for item in MIXED_SCORE_RANKED
    ]
    monkeypatch.setattr(
        main.index,
        "query",
        MagicMock(return_value=MagicMock(matches=matches)),
    )

    result = await main.search_chunks("What happened?", "video-123")

    assert len(result) == 2
    assert result[0]["text"] == "strong match"
    assert result[1]["text"] == "also strong"


@pytest.mark.asyncio
async def test_search_chunks_falls_back_when_all_scores_low(monkeypatch):
    monkeypatch.setattr(main, "SCORE_THRESHOLD", 0.35)
    monkeypatch.setattr(main, "embed_text", AsyncMock(return_value=[0.1] * 384))

    matches = [
        MagicMock(score=item["score"], metadata=item)
        for item in LOW_SCORE_RANKED
    ]
    monkeypatch.setattr(
        main.index,
        "query",
        MagicMock(return_value=MagicMock(matches=matches)),
    )

    result = await main.search_chunks("Anything?", "video-123")

    assert len(result) == 3
    assert result[0]["text"] == "weak match"
