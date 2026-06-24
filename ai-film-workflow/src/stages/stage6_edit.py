"""阶段6：后期合成/剪辑 - FFmpeg"""
import sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import os
import time
import subprocess
from pathlib import Path
from typing import List, Dict, Optional


class VideoEditor:
    def __init__(self):
        self.output_dir = Path("output/final")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir = Path("output/temp")
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self._check_ffmpeg()
    
    def _check_ffmpeg(self):
        try:
            result = subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                version = result.stdout.split('\n')[0]
                print(f"[OK] FFmpeg installed: {version}")
            else:
                print("[WARN] FFmpeg may not be properly installed")
        except FileNotFoundError:
            print("[ERROR] FFmpeg not installed! Please install: https://ffmpeg.org/download.html")
            raise RuntimeError("FFmpeg is required but not installed")
    
    def _run_ffmpeg(self, cmd: List[str]) -> str:
        full_cmd = ["ffmpeg", "-y"] + cmd
        print(f"[FFmpeg] {' '.join(full_cmd)}")
        
        result = subprocess.run(full_cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"[ERROR] FFmpeg: {result.stderr}")
            raise RuntimeError(f"FFmpeg failed: {result.stderr}")
        
        return result.stdout
    
    def concatenate_videos(self, video_files: List[str], output_name: str) -> str:
        print(f"[Stage 6] Concatenating {len(video_files)} video clips...")
        
        list_file = self.temp_dir / f"concat_list_{int(time.time())}.txt"
        with open(list_file, 'w', encoding='utf-8') as f:
            for video in video_files:
                abs_path = os.path.abspath(video).replace('\\', '/')
                f.write(f"file '{abs_path}'\n")
        
        output_path = self.output_dir / f"{output_name}.mp4"
        
        cmd = [
            "-f", "concat",
            "-safe", "0",
            "-i", str(list_file),
            "-c", "copy",
            str(output_path)
        ]
        
        self._run_ffmpeg(cmd)
        os.remove(list_file)
        
        print(f"[OK] Videos concatenated: {output_path}")
        return str(output_path)
    
    def add_audio_track(self, video_path: str, audio_path: str,
                        output_name: str,
                        audio_delay: float = 0,
                        audio_volume: float = 1.0) -> str:
        print(f"[Stage 6] Adding audio track...")
        
        output_path = self.output_dir / f"{output_name}.mp4"
        
        cmd = [
            "-i", video_path,
            "-i", audio_path,
            "-filter_complex",
            f"[1:a]adelay={int(audio_delay*1000)}|{int(audio_delay*1000)},volume={audio_volume}[aout]",
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            str(output_path)
        ]
        
        self._run_ffmpeg(cmd)
        print(f"[OK] Audio track added: {output_path}")
        return str(output_path)
    
    def mix_audio_tracks(self, video_path: str,
                         audio_tracks: List[Dict],
                         output_name: str) -> str:
        print(f"[Stage 6] Mixing {len(audio_tracks)} audio tracks...")
        
        output_path = self.output_dir / f"{output_name}.mp4"
        
        inputs = ["-i", video_path]
        filter_parts = []
        
        for i, track in enumerate(audio_tracks):
            inputs.extend(["-i", track['file']])
            delay = int(track.get('delay', 0) * 1000)
            volume = track.get('volume', 1.0)
            filter_parts.append(f"[{i+1}:a]adelay={delay}|{delay},volume={volume}[a{i}]")
        
        mix_inputs = "".join([f"[a{i}]" for i in range(len(audio_tracks))])
        filter_parts.append(f"{mix_inputs}amix=inputs={len(audio_tracks)}:duration=longest[aout]")
        
        filter_complex = ";".join(filter_parts)
        
        cmd = inputs + [
            "-filter_complex", filter_complex,
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            str(output_path)
        ]
        
        self._run_ffmpeg(cmd)
        print(f"[OK] Audio tracks mixed: {output_path}")
        return str(output_path)
    
    def add_subtitles(self, video_path: str, subtitle_path: str,
                      output_name: str, style: str = "default") -> str:
        print(f"[Stage 6] Adding subtitles...")
        
        output_path = self.output_dir / f"{output_name}.mp4"
        
        if style == "cinematic":
            subtitle_filter = (
                "subtitles='{}':force_style='"
                "FontName=Arial,FontSize=24,PrimaryColour=&H00FFFFFF,"
                "OutlineColour=&H00000000,Outline=2,"
                "Alignment=2,MarginV=50'"
            ).format(subtitle_path.replace('\\', '/').replace(':', '\\:'))
        else:
            subtitle_filter = f"subtitles='{subtitle_path.replace('\\', '/').replace(':', '\\:')}'"
        
        cmd = [
            "-i", video_path,
            "-vf", subtitle_filter,
            "-c:a", "copy",
            str(output_path)
        ]
        
        self._run_ffmpeg(cmd)
        print(f"[OK] Subtitles added: {output_path}")
        return str(output_path)
    
    def generate_subtitle_file(self, dialogues: List[Dict], output_path: str):
        def format_time(seconds: float) -> str:
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            millis = int((seconds % 1) * 1000)
            return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            for i, dialogue in enumerate(dialogues):
                f.write(f"{i+1}\n")
                f.write(f"{format_time(dialogue['start'])} --> {format_time(dialogue['end'])}\n")
                f.write(f"{dialogue['text']}\n\n")
        
        print(f"[OK] Subtitle file generated: {output_path}")
