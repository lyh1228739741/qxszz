"""阶段1：剧本生成"""
import sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import json
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.base_api import StreamingAPIClient
from config.api_config import OPENAI_API_KEY, OPENAI_BASE_URL, KIMI_API_KEY, KIMI_BASE_URL


SCRIPT_GENERATION_PROMPT = """你是一位资深电影编剧，擅长将创意转化为专业剧本。

请根据用户的创意，生成一份详细的电影剧本，包含以下内容：

## 1. 基本信息
- 片名
- 类型/风格
- 时长预估
- 目标受众

## 2. 故事梗概（200字以内）

## 3. 角色设定
每个角色包含：
- 姓名
- 年龄/性别
- 外貌特征（用于 AI 图像生成）
- 性格特点
- 在故事中的作用

## 4. 场景列表
每个场景包含：
- 场景编号
- 场景地点
- 时间（日/夜）
- 场景描述
- 涉及角色
- 情绪基调
- 关键对白

## 5. 视觉风格指引
- 整体色调
- 光影风格
- 镜头语言偏好
- 参考电影/作品

请用中文输出，格式清晰易读。
"""


class ScriptGenerator:
    """剧本生成器"""
    
    def __init__(self, provider: str = "openai"):
        self.provider = provider.lower()
        
        if self.provider == "openai":
            self.client = StreamingAPIClient(OPENAI_API_KEY, OPENAI_BASE_URL)
            self.model = "gpt-4o"
        elif self.provider == "kimi":
            self.client = StreamingAPIClient(KIMI_API_KEY, KIMI_BASE_URL)
            self.model = "kimi-k2.6"
        else:
            raise ValueError(f"Unsupported provider: {provider}")
    
    def generate(self, idea: str, style_notes: str = "") -> str:
        messages = [
            {"role": "system", "content": SCRIPT_GENERATION_PROMPT},
            {"role": "user", "content": f"创意：{idea}\n\n额外要求：{style_notes}" if style_notes else f"创意：{idea}"}
        ]
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.8,
            "max_tokens": 4000
        }
        
        print(f"[Stage 1] Generating script using {self.provider}/{self.model}...")
        
        full_response = ""
        for chunk in self.client.stream_post("chat/completions", payload):
            full_response += chunk
        
        print("[OK] Script generation complete!")
        return full_response
    
    def revise(self, original_script: str, feedback: str) -> str:
        messages = [
            {"role": "system", "content": "你是一位资深电影编剧。请根据用户的反馈修改剧本，保持整体结构完整。"},
            {"role": "user", "content": f"原始剧本：\n\n{original_script}\n\n修改意见：\n{feedback}\n\n请输出修改后的完整剧本。"}
        ]
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.8,
            "max_tokens": 4000
        }
        
        print("[Stage 1] Revising script based on feedback...")
        
        full_response = ""
        for chunk in self.client.stream_post("chat/completions", payload):
            full_response += chunk
        
        print("[OK] Script revision complete!")
        return full_response


if __name__ == "__main__":
    generator = ScriptGenerator(provider="openai")
    test_idea = "一个赛博朋克风格的短片，讲一个机器人在雨夜觉醒，开始质疑自己的存在意义"
    script = generator.generate(test_idea, "风格参考《银翼杀手2049》，色调偏冷，大量霓虹灯反射")
    print("\n" + "="*50)
    print("Generated Script:")
    print("="*50)
    print(script)
