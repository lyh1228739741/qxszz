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
    def __init__(self, style_prompt: str = ""):
        self.client = BaseAPIClient(GPT_IMAGE_API_KEY, GPT_IMAGE_BASE_URL)
        self.output_dir = Path("output/images")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.style_prompt = style_prompt
    
    def _apply_style(self, prompt: str) -> str:
        if self.style_prompt:
            return f"{prompt}\n\nStyle requirements: {self.style_prompt}"
        return prompt
    
    def generate(self, prompt: str, shot_id: str, size: str = "1024x1024", 
                 quality: str = "hd", style: str = "vivid") -> str:
        print(f"[Stage 3] Generating image [{shot_id}]...")
        final_prompt = self._apply_style(prompt)
        
        payload = {
            "model": "gpt-image-2",
            "prompt": final_prompt,
            "n": 1,
            "size": size,
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
