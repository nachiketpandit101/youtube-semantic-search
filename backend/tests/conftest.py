import os
import sys
from unittest.mock import MagicMock

os.environ.setdefault("PINECONE_API_KEY", "test-key")
os.environ.setdefault("GROQ_API_KEY", "test-key")
os.environ.setdefault("PINECONE_INDEX_NAME", "test-index")

_mock_embedder = MagicMock()
_mock_embedder.encode.return_value = [[0.0] * 384]

_sentence_transformers = MagicMock()
_sentence_transformers.SentenceTransformer.return_value = _mock_embedder
sys.modules.setdefault("sentence_transformers", _sentence_transformers)

_pinecone = MagicMock()
_mock_index = MagicMock()
_pinecone.Pinecone.return_value.Index.return_value = _mock_index
sys.modules.setdefault("pinecone", _pinecone)

_openai = MagicMock()
sys.modules.setdefault("openai", _openai)

_fastapi = MagicMock()
_fastapi.FastAPI = MagicMock
_fastapi.HTTPException = Exception
sys.modules.setdefault("fastapi", _fastapi)

_cors = MagicMock()
_cors.CORSMiddleware = MagicMock
sys.modules.setdefault("fastapi.middleware.cors", _cors)

_ytt = MagicMock()
sys.modules.setdefault("youtube_transcript_api", _ytt)

_dotenv = MagicMock()
_dotenv.load_dotenv = MagicMock()
sys.modules.setdefault("dotenv", _dotenv)
