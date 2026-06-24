"""阶段4：视频生成 - Seedance 2.0"""
import sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import os
import time
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.base_api import BaseAPIClient
from config.api_config import SEEDANCE_API_KEY, SEEDANCE_BASE_URL


class VideoGenerator:
    def __init__(self):
        self.client = BaseAPIClient(SEEDANCE_API_KEY, SEEDANCE_BASE_URL)
        self.output_dir = Path("output/videos")
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate(self, prompt: str, shot_id: str, 
                 image_path: str = None,
                 duration: int = 5,
                 resolution: str = "1080p",
                 aspect_ratio: str = "16:9") -> str:
        print(f"[Stage 4] Generating video [{shot_id}]...")
        
        payload = {
            "model": "seedance-2.0",
            "prompt": prompt,
            "duration": duration,
            "resolution": resolution,
            "aspect_ratio": aspect_ratio,
        }
        
        if image_path and os.path.exists(image_path):
            pass  # TODO: implement image upload
        
        try:
            response = self.client.post("videos/generations", payload)
            task_id = response.get('id')
            
            if not task_id:
                raise ValueError("No task ID returned")
            
            print(f"[Stage 4] Task submitted [{task_id}], waiting...")
            
            result = self.client.poll_task(
                f"videos/generations/{task_id}",
                check_interval=10,
                max_retries=120
            )
            
            video_url = result.get('video_url') or result.get('output', {}).get('video_url')
            if not video_url:
                raise ValueError("No video URL in response")
            
            import requests
            video_response = requests.get(video_url, timeout=120)
            video_response.raise_for_status()
            
            filename = f"{shot_id}_{int(time.time())}.mp4"
            filepath = self.output_dir / filename
            
            with open(filepath, 'wb') as f:
                f.write(video_response.content)
            
            print(f"[OK] Video saved: {filepath}")
            return str(filepath)
            
        except Exception as e:
            print(f"[ERROR] Video generation failed [{shot_id}]: {e}")
            raise
    
    def generate_batch(self, prompts: list, delay: int = 5) -> list:
        results = []
        for i, item in enumerate(prompts):
            try:
                filepath = self.generate(
                    prompt=item['prompt'],
                    shot_id=item['shot_id'],
                    image_path=item.get('image_path'),
                    duration=item.get('duration', 5)
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
