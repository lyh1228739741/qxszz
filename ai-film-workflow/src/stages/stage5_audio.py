"""阶段5：音频生成 - MiniMax + Suno + Noiz"""
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
from config.api_config import (
    MINIMAX_API_KEY, MINIMAX_BASE_URL,
    SUNO_API_KEY, SUNO_BASE_URL,
    NOIZ_API_KEY, NOIZ_BASE_URL
)


class AudioGenerator:
    def __init__(self):
        self.tts_client = BaseAPIClient(MINIMAX_API_KEY, MINIMAX_BASE_URL)
        self.music_client = BaseAPIClient(SUNO_API_KEY, SUNO_BASE_URL)
        self.sfx_client = BaseAPIClient(NOIZ_API_KEY, NOIZ_BASE_URL)
        
        self.output_dir = Path("output/audio")
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_tts(self, text: str, shot_id: str,
                     voice_id: str = "default",
                     emotion: str = "neutral",
                     speed: float = 1.0) -> str:
        print(f"[Stage 5] Generating TTS [{shot_id}]...")
        
        payload = {
            "model": "minimax-speech-01",
            "text": text,
            "voice_id": voice_id,
            "emotion": emotion,
            "speed": speed,
            "response_format": "mp3"
        }
        
        try:
            response = self.tts_client.post("tts/generate", payload, timeout=120)
            
            audio_url = response.get('audio_url') or response.get('data', {}).get('audio_url')
            
            if audio_url:
                import requests
                audio_response = requests.get(audio_url, timeout=60)
                audio_response.raise_for_status()
                
                filename = f"{shot_id}_tts_{int(time.time())}.mp3"
                filepath = self.output_dir / filename
                
                with open(filepath, 'wb') as f:
                    f.write(audio_response.content)
            else:
                audio_data = response.get('audio_data') or response.get('data', {}).get('audio')
                if audio_data:
                    import base64
                    audio_bytes = base64.b64decode(audio_data)
                    
                    filename = f"{shot_id}_tts_{int(time.time())}.mp3"
                    filepath = self.output_dir / filename
                    
                    with open(filepath, 'wb') as f:
                        f.write(audio_bytes)
                else:
                    raise ValueError("No audio data in response")
            
            print(f"[OK] TTS saved: {filepath}")
            return str(filepath)
            
        except Exception as e:
            print(f"[ERROR] TTS failed [{shot_id}]: {e}")
            raise
    
    def generate_dialogue(self, dialogues: list, delay: int = 1) -> list:
        results = []
        for i, item in enumerate(dialogues):
            try:
                filepath = self.generate_tts(
                    text=item['text'],
                    shot_id=item['shot_id'],
                    voice_id=item.get('voice_id', 'default'),
                    emotion=item.get('emotion', 'neutral')
                )
                results.append({
                    'shot_id': item['shot_id'],
                    'filepath': filepath,
                    'status': 'success'
                })
                if i < len(dialogues) - 1:
                    time.sleep(delay)
            except Exception as e:
                results.append({
                    'shot_id': item['shot_id'],
                    'filepath': None,
                    'status': 'failed',
                    'error': str(e)
                })
        return results
    
    def generate_music(self, prompt: str, track_name: str,
                       duration: int = 30,
                       genre: str = None,
                       mood: str = None) -> str:
        print(f"[Stage 5] Generating music [{track_name}]...")
        
        payload = {
            "prompt": prompt,
            "duration": duration,
            "model": "suno-v3"
        }
        
        if genre:
            payload["genre"] = genre
        if mood:
            payload["mood"] = mood
        
        try:
            response = self.music_client.post("generate", payload)
            task_id = response.get('id')
            
            if not task_id:
                raise ValueError("No task ID returned")
            
            print(f"[Stage 5] Music task submitted [{task_id}], waiting...")
            
            result = self.music_client.poll_task(
                f"generate/{task_id}",
                check_interval=10,
                max_retries=180
            )
            
            audio_url = result.get('audio_url')
            if not audio_url:
                raise ValueError("No audio URL in response")
            
            import requests
            audio_response = requests.get(audio_url, timeout=120)
            audio_response.raise_for_status()
            
            filename = f"music_{track_name}_{int(time.time())}.mp3"
            filepath = self.output_dir / filename
            
            with open(filepath, 'wb') as f:
                f.write(audio_response.content)
            
            print(f"[OK] Music saved: {filepath}")
            return str(filepath)
            
        except Exception as e:
            print(f"[ERROR] Music failed [{track_name}]: {e}")
            raise
    
    def generate_sfx(self, description: str, sfx_name: str,
                     duration: int = 3) -> str:
        print(f"[Stage 5] Generating SFX [{sfx_name}]...")
        
        payload = {
            "description": description,
            "duration": duration,
            "model": "noiz-sfx-01"
        }
        
        try:
            response = self.sfx_client.post("sfx/generate", payload, timeout=120)
            
            audio_url = response.get('audio_url') or response.get('data', {}).get('audio_url')
            
            if not audio_url:
                raise ValueError("No audio URL in response")
            
            import requests
            audio_response = requests.get(audio_url, timeout=60)
            audio_response.raise_for_status()
            
            filename = f"sfx_{sfx_name}_{int(time.time())}.mp3"
            filepath = self.output_dir / filename
            
            with open(filepath, 'wb') as f:
                f.write(audio_response.content)
            
            print(f"[OK] SFX saved: {filepath}")
            return str(filepath)
            
        except Exception as e:
            print(f"[ERROR] SFX failed [{sfx_name}]: {e}")
            raise
