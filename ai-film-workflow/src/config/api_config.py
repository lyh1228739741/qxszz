"""
API 配置模板
复制为 api_config_local.py 并填入你的真实 API Key
"""

# OpenAI / GPT
OPENAI_API_KEY = "your-openai-api-key"
OPENAI_BASE_URL = "https://api.openai.com/v1"

# Kimi (Moonshot)
KIMI_API_KEY = "your-kimi-api-key"
KIMI_BASE_URL = "https://api.moonshot.cn/v1"

# GPT-image-2 (通过 OpenAI API)
GPT_IMAGE_API_KEY = OPENAI_API_KEY  # 通常和 OpenAI 共用
GPT_IMAGE_BASE_URL = OPENAI_BASE_URL

# Seedance 2.0
SEEDANCE_API_KEY = "your-seedance-api-key"
SEEDANCE_BASE_URL = "https://api.seedance.io/v1"  # 请确认实际地址

# MiniMax TTS
MINIMAX_API_KEY = "your-minimax-api-key"
MINIMAX_BASE_URL = "https://api.minimax.chat/v1"

# Suno
SUNO_API_KEY = "your-suno-api-key"
SUNO_BASE_URL = "https://api.suno.ai/v1"  # 请确认实际地址

# Noiz
NOIZ_API_KEY = "your-noiz-api-key"
NOIZ_BASE_URL = "https://api.noiz.ai/v1"  # 请确认实际地址

# 默认模型配置
DEFAULT_SCRIPT_MODEL = "gpt-4o"  # 或 "kimi-k2.6"
DEFAULT_IMAGE_MODEL = "gpt-image-2"
DEFAULT_VIDEO_MODEL = "seedance-2.0"
DEFAULT_TTS_MODEL = "minimax-speech-01"
