"""
AI 影片工作流主控
串联所有阶段，提供交互式 CLI
"""
import sys
import io
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import os
import json
import time
from pathlib import Path
from typing import Optional, Dict, Any

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from stages.stage1_script import ScriptGenerator
from stages.stage2_storyboard import StoryboardGenerator
from stages.stage3_image import ImageGenerator
from stages.stage4_video import VideoGenerator
from stages.stage5_audio import AudioGenerator
from stages.stage6_edit import VideoEditor


class AIFilmWorkflow:
    """AI 影片生成工作流"""

    # 数据目录（环境变量配置，默认 ./data，Railway 上挂载 Volume 到 /data）
    DATA_ROOT = Path(os.environ.get("DATA_DIR", "data"))
    PROJECTS_ROOT = DATA_ROOT / "projects"

    def __init__(self, project_name: str):
        self.project_name = project_name
        self.project_dir = self.PROJECTS_ROOT / project_name
        self.project_dir.mkdir(parents=True, exist_ok=True)
        
        # 状态文件
        self.state_file = self.project_dir / "workflow_state.json"
        self.state = self._load_state()
        
        # 各阶段生成器
        self.script_gen = None
        self.storyboard_gen = None
        self.image_gen = None
        self.video_gen = None
        self.audio_gen = None
        self.editor = None
        
        # 确保初始状态文件存在（修复项目列表不显示bug）
        if not self.state_file.exists():
            self._save_state()
        
        print(f"[INFO] Workflow initialized: {project_name}")
    
    def _load_state(self) -> dict:
        """加载工作流状态"""
        if self.state_file.exists():
            with open(self.state_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "project_name": self.project_name,
            "current_stage": "stage1",
            "stage1_script": None,
            "stage2_storyboard": None,
            "stage3_assets": [],
            "stage3_asset_type": None,
            "stage4_storyboard": None,
            "stage4_videos": [],
            "stage4_audio": [],
            "stage4_final": None,
            "history": []
        }
    
    def _save_state(self):
        """保存工作流状态"""
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)
    
    def _log(self, message: str):
        """记录日志"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        self.state["history"].append(f"[{timestamp}] {message}")
        self._save_state()
        print(message)
    
    # ========== 阶段1：剧本生成 ==========
    
    def stage1_generate_script(self, idea: str, style_notes: str = "", 
                                provider: str = "openai") -> str:
        """阶段1：生成剧本"""
        self._log("=" * 50)
        self._log("[Stage 1] Script Generation")
        self._log("=" * 50)
        
        self.script_gen = ScriptGenerator(provider=provider)
        script = self.script_gen.generate(idea, style_notes)
        
        # 保存剧本
        script_file = self.project_dir / "script_v1.md"
        with open(script_file, 'w', encoding='utf-8') as f:
            f.write(script)
        
        self.state["current_stage"] = "stage1"
        self.state["stage1_script"] = str(script_file)
        self._save_state()
        
        self._log(f"[OK] Script saved: {script_file}")
        return script
    
    def stage1_revise_script(self, feedback: str) -> str:
        """修改剧本"""
        if not self.script_gen or not self.state["stage1_script"]:
            raise ValueError("Please generate script first")
        
        self._log("[Stage 1] Revising script...")
        
        # 读取当前剧本
        with open(self.state["stage1_script"], 'r', encoding='utf-8') as f:
            current_script = f.read()
        
        # 修改
        revised = self.script_gen.revise(current_script, feedback)
        
        # 保存新版本
        version = len(list(self.project_dir.glob("script_v*.md"))) + 1
        script_file = self.project_dir / f"script_v{version}.md"
        with open(script_file, 'w', encoding='utf-8') as f:
            f.write(revised)
        
        self.state["stage1_script"] = str(script_file)
        self._save_state()
        
        self._log(f"[OK] Script revised: {script_file}")
        return revised
    
    # ========== 阶段2：分镜脚本 ==========
    
    def stage2_generate_storyboard(self, visual_style: str = "",
                                    provider: str = "openai") -> dict:
        """阶段2：生成分镜脚本"""
        if not self.state["stage1_script"]:
            raise ValueError("Please complete Stage 1 first")
        
        self._log("=" * 50)
        self._log("[Stage 2] Storyboard Generation")
        self._log("=" * 50)
        
        # 读取确认的剧本
        with open(self.state["stage1_script"], 'r', encoding='utf-8') as f:
            script = f.read()
        
        self.storyboard_gen = StoryboardGenerator(provider=provider)
        storyboard = self.storyboard_gen.generate(script, visual_style)
        
        # 保存分镜
        storyboard_file = self.project_dir / "storyboard_v1.json"
        with open(storyboard_file, 'w', encoding='utf-8') as f:
            json.dump(storyboard, f, ensure_ascii=False, indent=2)
        
        # 同时保存人类可读的版本
        storyboard_md = self.project_dir / "storyboard_v1.md"
        self._storyboard_to_markdown(storyboard, storyboard_md)
        
        self.state["current_stage"] = "stage2"
        self.state["stage2_storyboard"] = str(storyboard_file)
        self._save_state()
        
        self._log(f"[OK] Storyboard saved: {storyboard_file}")
        return storyboard
    
    def stage2_revise_storyboard(self, feedback: str) -> dict:
        """修改分镜"""
        if not self.storyboard_gen or not self.state["stage2_storyboard"]:
            raise ValueError("Please generate storyboard first")
        
        self._log("[Stage 2] Revising storyboard...")
        
        with open(self.state["stage2_storyboard"], 'r', encoding='utf-8') as f:
            current_storyboard = json.load(f)
        
        revised = self.storyboard_gen.revise(current_storyboard, feedback)
        
        version = len(list(self.project_dir.glob("storyboard_v*.json"))) + 1
        storyboard_file = self.project_dir / f"storyboard_v{version}.json"
        with open(storyboard_file, 'w', encoding='utf-8') as f:
            json.dump(revised, f, ensure_ascii=False, indent=2)
        
        storyboard_md = self.project_dir / f"storyboard_v{version}.md"
        self._storyboard_to_markdown(revised, storyboard_md)
        
        self.state["stage2_storyboard"] = str(storyboard_file)
        self._save_state()
        
        self._log(f"[OK] Storyboard revised: {storyboard_file}")
        return revised
    
    def _storyboard_to_markdown(self, storyboard: dict, output_path: Path):
        """将分镜转换为 Markdown 格式"""
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# Storyboard\n\n")
            
            for shot in storyboard.get('shots', []):
                f.write(f"## {shot.get('shot_id', 'Unknown')}\n\n")
                f.write(f"**Scene:** {shot.get('scene', 'N/A')}\n\n")
                f.write(f"**Duration:** {shot.get('duration', 'N/A')}s\n\n")
                f.write(f"**Description:**\n{shot.get('description', 'N/A')}\n\n")
                f.write(f"**Composition:** {shot.get('composition', 'N/A')}\n\n")
                f.write(f"**Camera Movement:** {shot.get('camera_movement', 'N/A')}\n\n")
                f.write(f"**Lighting:** {shot.get('lighting', 'N/A')}\n\n")
                f.write(f"**AI Image Prompt:**\n```\n{shot.get('ai_image_prompt', 'N/A')}\n```\n\n")
                f.write(f"**AI Video Prompt:**\n```\n{shot.get('ai_video_prompt', 'N/A')}\n```\n\n")
                f.write(f"**Dialogue:** {shot.get('dialogue', 'N/A')}\n\n")
                f.write("---\n\n")
    
    # ========== 阶段3：图像生成 ==========
    
    def stage3_generate_assets(self, asset_type: str = "shots", selected_shots: list = None, style_prompt: str = "", resolution: str = "2k", ratio: str = "16:9") -> list:
        """阶段3：生成资产（角色/场景/道具/镜头）"""
        if not self.state["stage2_storyboard"]:
            raise ValueError("Please complete Stage 2 first")
        
        self._log("=" * 50)
        self._log(f"[Stage 3] Asset Generation: {asset_type}")
        self._log("=" * 50)
        
        with open(self.state["stage2_storyboard"], 'r', encoding='utf-8') as f:
            storyboard = json.load(f)
        
        self.image_gen = ImageGenerator(style_prompt=style_prompt, resolution=resolution, ratio=ratio)
        
        results = []
        
        if asset_type == "characters":
            # Generate character sheets from storyboard
            characters = storyboard.get('characters', [])
            for char in characters:
                try:
                    filepath = self.image_gen.generate_character_sheet(
                        char.get('description', char.get('name', 'character')),
                        char.get('name', 'character')
                    )
                    results.append({'shot_id': char.get('name', 'character'), 'filepath': filepath, 'status': 'success'})
                except Exception as e:
                    results.append({'shot_id': char.get('name', 'unknown'), 'filepath': None, 'status': 'failed', 'error': str(e)})
        
        elif asset_type == "scenes":
            # Generate scene concept art by unique scenes
            seen = set()
            for shot in storyboard.get('shots', []):
                scene_id = shot.get('scene', 'unknown')
                if scene_id not in seen:
                    seen.add(scene_id)
                    scene_desc = shot.get('description', f'Scene {scene_id}')
                    try:
                        filepath = self.image_gen.generate_scene_concept(scene_desc, scene_id)
                        results.append({'shot_id': scene_id, 'filepath': filepath, 'status': 'success'})
                    except Exception as e:
                        results.append({'shot_id': scene_id, 'filepath': None, 'status': 'failed', 'error': str(e)})
        
        else:
            # Default: generate per-shot images
            prompts = self.storyboard_gen.extract_image_prompts(storyboard)
            if selected_shots:
                prompts = [p for p in prompts if p['shot_id'] in selected_shots]
            self._log(f"Generating {len(prompts)} shot images...")
            results = self.image_gen.generate_batch(prompts)
        
        # Merge with existing assets
        existing = self.state["stage3_assets"]
        existing.extend(results)
        self.state["stage3_assets"] = existing
        self.state["stage3_asset_type"] = asset_type
        self.state["current_stage"] = "stage3"
        self._save_state()
        
        success = sum(1 for r in results if r['status'] == 'success')
        self._log(f"[OK] Assets ({asset_type}): {success}/{len(results)} succeeded")
        
        return results
    
    # ========== 阶段4：分镜画面（可选） ==========
    
    def stage4_generate_visual_storyboard(self) -> dict:
        """阶段4：将资产与分镜结合，生成带画面的分镜板"""
        if not self.state["stage2_storyboard"]:
            raise ValueError("Please complete Stage 2 first")
        
        self._log("=" * 50)
        self._log("[Stage 4] Visual Storyboard Generation")
        self._log("=" * 50)
        
        with open(self.state["stage2_storyboard"], 'r', encoding='utf-8') as f:
            storyboard = json.load(f)
        
        # 组装分镜板：每个镜头对应的资产和描述
        shots = storyboard.get('shots', [])
        assets = {a['shot_id']: a for a in self.state.get("stage3_assets", []) if a['status'] == 'success'}
        
        visual_storyboard = {
            "project": self.project_name,
            "shots": []
        }
        
        for shot in shots:
            shot_id = shot.get('shot_id', 'unknown')
            shot_entry = {
                "shot_id": shot_id,
                "scene": shot.get('scene', ''),
                "duration": shot.get('duration', 5),
                "description": shot.get('description', ''),
                "composition": shot.get('composition', ''),
                "camera_movement": shot.get('camera_movement', ''),
                "lighting": shot.get('lighting', ''),
                "dialogue": shot.get('dialogue', ''),
                "asset": assets.get(shot_id, None),
                "video_prompt": shot.get('ai_video_prompt', '')
            }
            visual_storyboard["shots"].append(shot_entry)
        
        # 保存
        vs_file = self.project_dir / "visual_storyboard.json"
        with open(vs_file, 'w', encoding='utf-8') as f:
            json.dump(visual_storyboard, f, ensure_ascii=False, indent=2)
        
        self.state["stage4_storyboard"] = str(vs_file)
        self.state["current_stage"] = "stage4"
        self._save_state()
        
        self._log(f"[OK] Visual storyboard saved: {vs_file}")
        return visual_storyboard
    
    # ========== 阶段4：视频生成 ==========
    
    def stage4_generate_videos(self, selected_shots: list = None,
                                use_images: bool = True) -> list:
        """阶段4：生成视频"""
        if not self.state["stage2_storyboard"]:
            raise ValueError("Please complete Stage 2 first")
        
        self._log("=" * 50)
        self._log("[Stage 4] Video Generation")
        self._log("=" * 50)
        
        with open(self.state["stage2_storyboard"], 'r', encoding='utf-8') as f:
            storyboard = json.load(f)
        
        self.video_gen = VideoGenerator()
        
        prompts = self.storyboard_gen.extract_video_prompts(storyboard)
        
        if selected_shots:
            prompts = [p for p in prompts if p['shot_id'] in selected_shots]
        
        if use_images and self.state["stage3_assets"]:
            image_map = {img['shot_id']: img['filepath'] 
                        for img in self.state["stage3_assets"] 
                        if img['status'] == 'success'}
            for prompt in prompts:
                if prompt['shot_id'] in image_map:
                    prompt['image_path'] = image_map[prompt['shot_id']]
        
        self._log(f"Generating {len(prompts)} video clips...")
        
        results = self.video_gen.generate_batch(prompts)
        
        self.state["stage4_videos"] = results
        self.state["current_stage"] = "stage4"
        self._save_state()
        
        success = sum(1 for r in results if r['status'] == 'success')
        self._log(f"[OK] Videos: {success}/{len(prompts)} succeeded")
        
        return results
    
    # ========== 阶段5：音频生成 ==========
    
    def stage5_generate_audio(self) -> dict:
        """阶段5：生成音频（对白 + 音乐 + 音效）"""
        if not self.state["stage2_storyboard"]:
            raise ValueError("Please complete Stage 2 first")
        
        self._log("=" * 50)
        self._log("[Stage 5] Audio Generation")
        self._log("=" * 50)
        
        with open(self.state["stage2_storyboard"], 'r', encoding='utf-8') as f:
            storyboard = json.load(f)
        
        self.audio_gen = AudioGenerator()
        
        results = {
            "dialogues": [],
            "music": [],
            "sfx": []
        }
        
        # 1. 生成对白
        dialogues = []
        for shot in storyboard.get('shots', []):
            if shot.get('dialogue'):
                dialogues.append({
                    'shot_id': shot['shot_id'],
                    'text': shot['dialogue'],
                    'emotion': shot.get('emotion', 'neutral'),
                    'voice_id': shot.get('voice_id', 'default')
                })
        
        if dialogues:
            self._log(f"Generating {len(dialogues)} dialogues...")
            results["dialogues"] = self.audio_gen.generate_dialogue(dialogues)
        
        # 2. 生成背景音乐
        scenes = {}
        for shot in storyboard.get('shots', []):
            scene_id = shot.get('scene', 'default')
            if scene_id not in scenes:
                scenes[scene_id] = {
                    'mood': shot.get('mood', 'neutral'),
                    'description': shot.get('music_description', 'background music')
                }
        
        for scene_id, scene_info in scenes.items():
            try:
                music_path = self.audio_gen.generate_music(
                    prompt=scene_info['description'],
                    track_name=scene_id,
                    duration=30,
                    mood=scene_info['mood']
                )
                results["music"].append({
                    'scene': scene_id,
                    'filepath': music_path,
                    'status': 'success'
                })
            except Exception as e:
                results["music"].append({
                    'scene': scene_id,
                    'filepath': None,
                    'status': 'failed',
                    'error': str(e)
                })
        
        # 3. 生成音效
        sfx_list = []
        for shot in storyboard.get('shots', []):
            if shot.get('sfx_description'):
                sfx_list.append({
                    'shot_id': shot['shot_id'],
                    'description': shot['sfx_description'],
                    'sfx_name': f"{shot['shot_id']}_sfx"
                })
        
        for sfx in sfx_list:
            try:
                sfx_path = self.audio_gen.generate_sfx(
                    description=sfx['description'],
                    sfx_name=sfx['sfx_name']
                )
                results["sfx"].append({
                    'shot_id': sfx['shot_id'],
                    'filepath': sfx_path,
                    'status': 'success'
                })
            except Exception as e:
                results["sfx"].append({
                    'shot_id': sfx['shot_id'],
                    'filepath': None,
                    'status': 'failed',
                    'error': str(e)
                })
        
        self.state["stage4_audio"] = results
        self.state["current_stage"] = "stage4"
        self._save_state()
        
        self._log("[OK] Audio generation completed")
        return results
    
    # ========== 阶段6：后期合成 ==========
    
    def stage6_compose_final(self, output_name: str = None) -> str:
        """阶段6：合成最终成片"""
        if not self.state["stage4_videos"]:
            raise ValueError("Please complete Stage 4 first")
        
        self._log("=" * 50)
        self._log("[Stage 6] Final Composition")
        self._log("=" * 50)
        
        self.editor = VideoEditor()
        
        video_files = [v['filepath'] for v in self.state["stage4_videos"] 
                      if v['status'] == 'success']
        
        if not video_files:
            raise ValueError("No available video clips")
        
        self._log(f"Concatenating {len(video_files)} video clips...")
        
        temp_name = f"{self.project_name}_concat"
        concat_path = self.editor.concatenate_videos(video_files, temp_name)
        
        final_path = concat_path
        if self.state["stage4_audio"]:
            audio_tracks = []
            
            for dialogue in self.state["stage4_audio"].get("dialogues", []):
                if dialogue['status'] == 'success':
                    audio_tracks.append({
                        'file': dialogue['filepath'],
                        'delay': 0,
                        'volume': 1.0,
                        'type': 'dialogue'
                    })
            
            for music in self.state["stage4_audio"].get("music", []):
                if music['status'] == 'success':
                    audio_tracks.append({
                        'file': music['filepath'],
                        'delay': 0,
                        'volume': 0.3,
                        'type': 'music'
                    })
            
            for sfx in self.state["stage4_audio"].get("sfx", []):
                if sfx['status'] == 'success':
                    audio_tracks.append({
                        'file': sfx['filepath'],
                        'delay': 0,
                        'volume': 0.8,
                        'type': 'sfx'
                    })
            
            if audio_tracks:
                self._log("Mixing audio tracks...")
                final_name = f"{self.project_name}_with_audio"
                final_path = self.editor.mix_audio_tracks(concat_path, audio_tracks, final_name)
        
        if not output_name:
            output_name = f"{self.project_name}_final"
        
        final_output = self.project_dir / f"{output_name}.mp4"
        os.rename(final_path, final_output)
        
        self.state["stage4_final"] = str(final_output)
        self.state["current_stage"] = "stage4"
        self._save_state()
        
        self._log(f"[OK] Final video: {final_output}")
        return str(final_output)
    
    # ========== 工具方法 ==========
    
    def get_status(self) -> dict:
        """获取当前工作流状态 - 5阶段"""
        return {
            "project_name": self.project_name,
            "current_stage": self.state["current_stage"],
            "stage1_complete": self.state["stage1_script"] is not None,
            "stage2_complete": self.state["stage2_storyboard"] is not None,
            "stage3_complete": len(self.state["stage3_assets"]) > 0,
            "stage3_images_count": len(self.state["stage3_assets"]),
            "stage4_complete": self.state["stage4_storyboard"] is not None,
            "stage5_complete": self.state["stage4_final"] is not None,
            "stage5_videos_count": len(self.state["stage4_videos"]),
        }
    
    def print_status(self):
        """打印状态"""
        status = self.get_status()
        print("\n" + "=" * 50)
        print("[Status] Workflow Status")
        print("=" * 50)
        print(f"Project: {status['project_name']}")
        print(f"Current Stage: {status['current_stage'] or 'Not started'}")
        print(f"Stage 1 Script: {'Done' if status['stage1_complete'] else 'Pending'}")
        print(f"Stage 2 Storyboard: {'Done' if status['stage2_complete'] else 'Pending'}")
        print(f"Stage 3 Assets: {status['stage3_images_count']} images")
        print(f"Stage 4 Visual Storyboard: {'Done' if status['stage4_complete'] else 'Pending'}")
        print(f"Stage 5 Film: {'Done' if status['stage5_complete'] else 'Pending'}")
        print("=" * 50 + "\n")


def interactive_cli():
    """交互式命令行界面"""
    print("AI Film Workflow")
    print("=" * 50)
    
    project_name = input("Enter project name: ").strip()
    if not project_name:
        project_name = f"project_{int(time.time())}"
    
    workflow = AIFilmWorkflow(project_name)
    
    while True:
        workflow.print_status()
        
        print("Options:")
        print("1. Stage 1: Generate Script")
        print("2. Stage 1: Revise Script")
        print("3. Stage 2: Generate Storyboard")
        print("4. Stage 2: Revise Storyboard")
        print("5. Stage 3: Generate Assets")
        print("6. Stage 4: Make Film (video+audio+compose)")
        print("7. View Status")
        print("0. Exit")
        
        choice = input("\nSelect option: ").strip()
        
        try:
            if choice == "1":
                idea = input("Enter your idea: ")
                style = input("Enter style notes (optional): ")
                provider = input("API provider (openai/kimi, default: openai): ").strip() or "openai"
                workflow.stage1_generate_script(idea, style, provider)
                
            elif choice == "2":
                if not workflow.state["stage1_script"]:
                    print("[ERROR] Please generate script first")
                    continue
                feedback = input("Enter revision feedback: ")
                workflow.stage1_revise_script(feedback)
                
            elif choice == "3":
                style = input("Enter visual style notes (optional): ")
                provider = input("API provider (openai/kimi, default: openai): ").strip() or "openai"
                workflow.stage2_generate_storyboard(style, provider)
                
            elif choice == "4":
                if not workflow.state["stage2_storyboard"]:
                    print("[ERROR] Please generate storyboard first")
                    continue
                feedback = input("Enter revision feedback: ")
                workflow.stage2_revise_storyboard(feedback)
                
            elif choice == "5":
                atype = input("Asset type (shots/characters/scenes): ").strip() or "shots"
                shots = input("Specify shot IDs (comma separated, empty=all): ").strip()
                shot_list = [s.strip() for s in shots.split(",")] if shots else None
                workflow.stage3_generate_assets(atype, shot_list)
                
            elif choice == "6":
                use_img = input("Use reference images? (y/n, default: y): ").strip().lower() != "n"
                name = input("Output filename (optional): ").strip()
                workflow.stage4_generate_videos(None, use_img)
                workflow.stage5_generate_audio()
                workflow.stage6_compose_final(name or None)
                
            elif choice == "7":
                workflow.print_status()
                
            elif choice == "0":
                print("Goodbye!")
                break
                
            else:
                print("[ERROR] Invalid option")
                
        except Exception as e:
            print(f"[ERROR] {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    interactive_cli()
