"""阶段3：图像生成 - GPT-image-2"""
import sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import os
import base64
import time
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.base_api import BaseAPIClient
from config.api_config import GPT_IMAGE_API_KEY, GPT_IMAGE_BASE_URL


class ImageGenerator:
    # 尺寸映射
    RATIO_TO_SIZE = {
        '1:1': '1024x1024', '3:2': '1536x1024', '2:3': '1024x1536',
        '4:3': '1536x1152', '3:4': '1152x1536', '9:16': '1152x2048',
        '16:9': '2048x1152', '21:9': '2520x1080', '4:5': '1024x1280'
    }
    RES_TO_SCALE = {'1k': 1, '2k': 1.5, '4k': 2}

    def __init__(self, style_prompt: str = "", resolution: str = "2k", ratio: str = "16:9"):
        self.client = BaseAPIClient(GPT_IMAGE_API_KEY, GPT_IMAGE_BASE_URL)
        self.output_dir = Path("output/images")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.style_prompt = style_prompt
        self.resolution = resolution
        self.ratio = ratio
    
    def _get_size(self) -> str:
        base = self.RATIO_TO_SIZE.get(self.ratio, '1024x1024')
        scale = self.RES_TO_SCALE.get(self.resolution, 1)
        if scale == 1:
            return base
        w, h = base.split('x')
        return f"{int(int(w)*scale)}x{int(int(h)*scale)}"
    
    def _apply_style(self, prompt: str) -> str:
        if self.style_prompt:
            return f"{prompt}\n\nStyle requirements: {self.style_prompt}"
        return prompt
    
    def generate(self, prompt: str, shot_id: str, size: str = None, 
                 quality: str = "hd", style: str = "vivid") -> str:
        print(f"[Stage 3] Generating image [{shot_id}]...")
        final_prompt = self._apply_style(prompt)
        img_size = size or self._get_size()
        
        payload = {
            "model": "gpt-image-2",
            "prompt": final_prompt,
            "n": 1,
            "size": img_size,
            "quality": quality,
            "style": style,
            "response_format": "b64_json"
        }
        
        try:
            response = self.client.post("images/generations", payload, timeout=180)
            image_data = base64.b64decode(response['data'][0]['b64_json'])
            
            ext = "png"
            filename = f"{shot_id}_{int(time.time())}.{ext}"
            filepath = self.output_dir / filename
            
            with open(filepath, 'wb') as f:
                f.write(image_data)
            
            print(f"[OK] Image saved: {filepath}")
            return str(filepath)
            
        except Exception as e:
            print(f"[ERROR] Image generation failed [{shot_id}]: {e}")
            raise
    
    def generate_batch(self, prompts: list, delay: int = 2) -> list:
        results = []
        for i, item in enumerate(prompts):
            try:
                filepath = self.generate(
                    prompt=item['prompt'],
                    shot_id=item['shot_id'],
                    size=item.get('size', '1024x1024')
                )
                results.append({
                    'shot_id': item['shot_id'],
                    'filepath': filepath,
                    'status': 'success'
                })
                if i < len(prompts) - 1:
                    time.sleep(delay)
            except Exception as e:
                results.append({
                    'shot_id': item['shot_id'],
                    'filepath': None,
                    'status': 'failed',
                    'error': str(e)
                })
        return results
    
    def generate_character_sheet(self, character_description: str, character_name: str) -> str:
        prompt = f"""Character reference sheet for {character_name}.
Multiple angles and expressions on clean white background.
Consistent character design.

Character description: {character_description}

Style: Detailed digital art, consistent lighting, professional character design sheet."""
        return self.generate(prompt, f"character_{character_name}", size="1792x1024")
    
    def generate_scene_concept(self, scene_description: str, scene_id: str, mood: str = "cinematic") -> str:
        prompt = f"""Cinematic scene concept art.
{scene_description}

Mood: {mood}
Style: Cinematic lighting, highly detailed, 8k resolution, professional concept art."""
        return self.generate(prompt, f"scene_{scene_id}", size="1792x1024")
