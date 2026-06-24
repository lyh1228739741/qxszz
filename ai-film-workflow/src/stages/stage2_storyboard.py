"""阶段2：分镜脚本生成"""
import sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import json
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.base_api import StreamingAPIClient
from config.api_config import OPENAI_API_KEY, OPENAI_BASE_URL


STORYBOARD_PROMPT = """你是一位资深电影分镜师和摄影指导（DP）。

请根据提供的剧本，生成一份专业的分镜脚本（Storyboard），每个场景拆解为多个镜头。

每个镜头必须包含：

## 镜头信息
- 镜头编号（如 SC01-SH01）
- 所属场景
- 时长（秒）

## 画面描述（给 AI 看的）
- 主体描述（人物/道具/场景）
- 构图（特写/近景/中景/全景/远景）
- 机位高度（平视/俯拍/仰拍）
- 运镜方式（固定/推/拉/摇/移/跟/升降）
- 光影描述（主光源方向、色温、对比度、氛围）
- 色彩基调

## AI 图像生成提示词（英文）
- 针对 GPT-image-2 优化的详细提示词

## AI 视频生成提示词（英文）
- 针对 Seedance 2.0 优化的动态描述

## 音频备注
- 对白（如果有）
- 音效需求
- 音乐情绪

输出格式为 JSON，方便程序解析。
"""


class StoryboardGenerator:
    def __init__(self, provider: str = "openai"):
        self.provider = provider.lower()
        
        if self.provider == "openai":
            self.client = StreamingAPIClient(OPENAI_API_KEY, OPENAI_BASE_URL)
            self.model = "gpt-4o"
        elif self.provider == "kimi":
            from config.api_config import KIMI_API_KEY, KIMI_BASE_URL
            self.client = StreamingAPIClient(KIMI_API_KEY, KIMI_BASE_URL)
            self.model = "moonshot-v1-8k"
        else:
            raise ValueError(f"Unsupported provider: {provider}")
    
    def generate(self, script: str, visual_style: str = "") -> dict:
        messages = [
            {"role": "system", "content": STORYBOARD_PROMPT},
            {"role": "user", "content": f"剧本：\n\n{script}\n\n视觉风格要求：{visual_style}" if visual_style else f"剧本：\n\n{script}"}
        ]
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 8000,
            "response_format": {"type": "json_object"}
        }
        
        print(f"[Stage 2] Generating storyboard using {self.provider}/{self.model}...")
        
        response = self.client.post("chat/completions", payload)
        content = response['choices'][0]['message']['content']
        
        try:
            storyboard = json.loads(content)
            print(f"[OK] Storyboard generated: {len(storyboard.get('shots', []))} shots")
            return storyboard
        except json.JSONDecodeError:
            print("[WARN] Response is not valid JSON, returning raw text")
            return {"raw_text": content, "shots": []}
    
    def revise(self, storyboard: dict, feedback: str) -> dict:
        storyboard_json = json.dumps(storyboard, ensure_ascii=False, indent=2)
        
        messages = [
            {"role": "system", "content": "你是一位资深分镜师。请根据反馈修改分镜脚本，保持 JSON 格式。"},
            {"role": "user", "content": f"当前分镜：\n\n{storyboard_json}\n\n修改意见：\n{feedback}\n\n请输出修改后的完整分镜 JSON。"}
        ]
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 8000,
            "response_format": {"type": "json_object"}
        }
        
        print("[Stage 2] Revising storyboard...")
        
        response = self.client.post("chat/completions", payload)
        content = response['choices'][0]['message']['content']
        
        try:
            revised = json.loads(content)
            print("[OK] Storyboard revision complete!")
            return revised
        except json.JSONDecodeError:
            return {"raw_text": content, "shots": []}
    
    def extract_image_prompts(self, storyboard: dict) -> list:
        prompts = []
        for shot in storyboard.get('shots', []):
            prompt = shot.get('ai_image_prompt', '')
            if prompt:
                prompts.append({
                    'shot_id': shot.get('shot_id', 'unknown'),
                    'prompt': prompt,
                    'negative_prompt': shot.get('ai_negative_prompt', '')
                })
        return prompts
    
    def extract_video_prompts(self, storyboard: dict) -> list:
        prompts = []
        for shot in storyboard.get('shots', []):
            prompt = shot.get('ai_video_prompt', '')
            if prompt:
                prompts.append({
                    'shot_id': shot.get('shot_id', 'unknown'),
                    'prompt': prompt,
                    'duration': shot.get('duration', 5)
                })
        return prompts
