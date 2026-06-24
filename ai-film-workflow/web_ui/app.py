# -*- coding: utf-8 -*-
"""AI Film Workflow - Web UI (5-stage)"""
import sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import json
import os
import time
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))
from workflow import AIFilmWorkflow

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# 数据目录（与 workflow.py 保持一致）
DATA_ROOT = Path(os.environ.get("DATA_DIR", "data"))
PROJECTS_DIR = DATA_ROOT / "projects"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

active_workflows = {}

def _get_workflow(name):
    if name not in active_workflows:
        active_workflows[name] = AIFilmWorkflow(name)
    return active_workflows[name]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/projects', methods=['GET'])
def list_projects():
    if not PROJECTS_DIR.exists():
        PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    projects = []
    for p in PROJECTS_DIR.iterdir():
        if p.is_dir():
            sf = p / "workflow_state.json"
            current_stage = "stage1"
            if sf.exists():
                with open(sf, 'r', encoding='utf-8') as f:
                    s = json.load(f)
                current_stage = s.get("current_stage", "stage1")
            projects.append({"name": p.name, "current_stage": current_stage})
    return jsonify({"projects": projects})

@app.route('/api/project/create', methods=['POST'])
def create_project():
    data = request.json
    name = data.get('name', f"project_{int(time.time())}")
    wf = _get_workflow(name)
    return jsonify({"success": True, "project_name": name, "status": wf.get_status()})

@app.route('/api/project/<name>/status', methods=['GET'])
def get_status(name):
    return jsonify(_get_workflow(name).get_status())

@app.route('/api/project/<name>', methods=['DELETE'])
def delete_project(name):
    import shutil
    project_dir = PROJECTS_DIR / name
    if project_dir.exists():
        shutil.rmtree(project_dir)
    if name in active_workflows:
        del active_workflows[name]
    return jsonify({"success": True, "deleted": name})

# ===== Stage 1: Script =====

@app.route('/api/project/<name>/stage1/generate', methods=['POST'])
def stage1_gen(name):
    data = request.json or {}
    wf = _get_workflow(name)
    try:
        script = wf.stage1_generate_script(
            data.get('idea', '') or data.get('uploaded_content', ''),
            data.get('style', ''),
            data.get('provider', 'openai')
        )
        return jsonify({"success": True, "script": script, "status": wf.get_status()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/project/<name>/stage1/revise', methods=['POST'])
def stage1_revise(name):
    try:
        wf = _get_workflow(name)
        script = wf.stage1_revise_script(request.json.get('feedback', ''))
        return jsonify({"success": True, "script": script, "status": wf.get_status()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ===== Stage 2: Storyboard =====

@app.route('/api/project/<name>/stage2/generate', methods=['POST'])
def stage2_gen(name):
    data = request.json or {}
    try:
        wf = _get_workflow(name)
        sb = wf.stage2_generate_storyboard(data.get('style', ''), data.get('provider', 'openai'))
        return jsonify({"success": True, "storyboard": sb, "status": wf.get_status()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/project/<name>/stage2/revise', methods=['POST'])
def stage2_revise(name):
    try:
        wf = _get_workflow(name)
        sb = wf.stage2_revise_storyboard(request.json.get('feedback', ''))
        return jsonify({"success": True, "storyboard": sb, "status": wf.get_status()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ===== Stage 3: Assets =====

@app.route('/api/project/<name>/stage3/generate', methods=['POST'])
def stage3_gen(name):
    data = request.json or {}
    try:
        wf = _get_workflow(name)
        results = wf.stage3_generate_assets(data.get('asset_type', 'shots'), data.get('shots'), data.get('style_prompt', ''))
        return jsonify({"success": True, "results": results, "status": wf.get_status()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ===== Stage 4: Visual Storyboard (optional) =====

@app.route('/api/project/<name>/stage4/generate', methods=['POST'])
def stage4_gen(name):
    try:
        wf = _get_workflow(name)
        result = wf.stage4_generate_visual_storyboard()
        return jsonify({"success": True, "result": result, "status": wf.get_status()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ===== Stage 5: Make Film =====

@app.route('/api/project/<name>/stage5a/generate', methods=['POST'])
def stage5a_gen(name):
    data = request.json or {}
    try:
        wf = _get_workflow(name)
        results = wf.stage4_generate_videos(None, data.get('use_images', True))
        return jsonify({"success": True, "results": results, "status": wf.get_status()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/project/<name>/stage5b/generate', methods=['POST'])
def stage5b_gen(name):
    try:
        wf = _get_workflow(name)
        results = wf.stage5_generate_audio()
        return jsonify({"success": True, "results": results, "status": wf.get_status()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/project/<name>/stage5c/compose', methods=['POST'])
def stage5c_compose(name):
    data = request.json or {}
    try:
        wf = _get_workflow(name)
        path = wf.stage6_compose_final(data.get('output_name'))
        return jsonify({"success": True, "final_video": path, "status": wf.get_status()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ===== File Serving =====

@app.route('/api/project/<name>/files/<path:filename>')
def serve_file(name, filename):
    fp = PROJECTS_DIR / name / filename
    if fp.exists(): return send_file(fp)
    return jsonify({"error": "not found"}), 404

@app.route('/api/output/<path:filename>')
def serve_output(filename):
    fp = Path("output") / filename
    if fp.exists(): return send_file(fp)
    return jsonify({"error": "not found"}), 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    print(f"AI Film Workflow Web UI (5-stage) :{port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
