"""
API 配置 - 优先读取环境变量，fallback 到默认值
"""
import os

# OpenAI / GPT
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "your-openai-api-key")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")

# Kimi (Moonshot)
KIMI_API_KEY = os.environ.get("KIMI_API_KEY", "your-kimi-api-key")
KIMI_BASE_URL = os.environ.get("KIMI_BASE_URL", "https://api.moonshot.cn/v1")

# GPT-image-2 (通过 OpenAI API)
GPT_IMAGE_API_KEY = os.environ.get("GPT_IMAGE_API_KEY", OPENAI_API_KEY)
GPT_IMAGE_BASE_URL = os.environ.get("GPT_IMAGE_BASE_URL", OPENAI_BASE_URL)

# Seedance 2.0
SEEDANCE_API_KEY = os.environ.get("SEEDANCE_API_KEY", "your-seedance-api-key")
SEEDANCE_BASE_URL = os.environ.get("SEEDANCE_BASE_URL", "https://api.seedance.io/v1")

# MiniMax TTS
MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "your-minimax-api-key")
MINIMAX_BASE_URL = os.environ.get("MINIMAX_BASE_URL", "https://api.minimax.chat/v1")

# Suno
SUNO_API_KEY = os.environ.get("SUNO_API_KEY", "your-suno-api-key")
SUNO_BASE_URL = os.environ.get("SUNO_BASE_URL", "https://api.suno.ai/v1")

# Noiz
NOIZ_API_KEY = os.environ.get("NOIZ_API_KEY", "your-noiz-api-key")
NOIZ_BASE_URL = os.environ.get("NOIZ_BASE_URL", "https://api.noiz.ai/v1")

# DeepSeek
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "your-deepseek-api-key")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")

# 默认模型配置
DEFAULT_SCRIPT_MODEL = "gpt-4o"
DEFAULT_IMAGE_MODEL = "gpt-image-2"
DEFAULT_VIDEO_MODEL = "seedance-2.0"
DEFAULT_TTS_MODEL = "minimax-speech-01"
