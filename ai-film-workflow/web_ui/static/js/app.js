/**
 * AI 影片工作流 - 5 阶段独立页面版 + 进度条
 */

let currentProject = null;
let currentStage = 1;
let uploadedScriptContent = null;
let uploadedAssets = { characters: null, scenes: null, props: null };
let stage4Skipped = false;
let stageCompletion = {}; // {1: true, 2: false, ...}

// ========== 工具 ==========

function showLoading(text = '处理中...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loading').style.display = 'flex';
}
function hideLoading() { document.getElementById('loading').style.display = 'none'; }
function showError(message) { alert('错误: ' + message); }
function showSuccess(message) { /* silent success */ }

async function apiCall(url, method = 'GET', data = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) options.body = JSON.stringify(data);
    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result;
}

// ========== 视图切换 ==========

function showHomeView() {
    document.getElementById('homeView').style.display = 'block';
    document.getElementById('workflowView').style.display = 'none';
    currentProject = null;
    currentStage = 1;
    loadProjects();
}

function showWorkflowView(projectName) {
    document.getElementById('homeView').style.display = 'none';
    document.getElementById('workflowView').style.display = 'block';
    document.getElementById('workflowProjectTitle').textContent = `🎬 ${projectName}`;
}

function goBackHome() {
    currentProject = null;
    currentStage = 1;
    stage4Skipped = false;
    uploadedAssets = { characters: null, scenes: null, props: null };
    uploadedScriptContent = null;
    stageCompletion = {};
    refImageData = null;
    // 清空各阶段内容
    document.getElementById('scriptDisplay').textContent = '';
    document.getElementById('scriptRevision').style.display = 'none';
    document.getElementById('scriptFeedback').value = '';
    document.getElementById('storyboardDisplay').innerHTML = '';
    document.getElementById('storyboardRevision').style.display = 'none';
    document.getElementById('storyboardFeedback').value = '';
    document.getElementById('charResults').innerHTML = '';
    document.getElementById('sceneResults').innerHTML = '';
    document.getElementById('propResults').innerHTML = '';
    document.getElementById('visualStoryboardDisplay').textContent = '';
    document.getElementById('finalResult').innerHTML = '';
    document.getElementById('filmProgress').style.display = 'none';
    document.getElementById('filmProgress').innerHTML = '';
    document.getElementById('refImagePreview').innerHTML = '';
    document.getElementById('refImageName').textContent = '';
    showHomeView();
}

// ========== 进度条 + 阶段切换 ==========

function updateProgressBar() {
    const nodes = document.querySelectorAll('.progress-node');
    const lines = document.querySelectorAll('.progress-line');

    nodes.forEach((node, i) => {
        const stage = i + 1;
        node.classList.remove('active', 'completed');
        if (stage === currentStage) {
            node.classList.add('active');
        } else if (stageCompletion[stage]) {
            node.classList.add('completed');
        }
    });

    // 更新线条
    lines.forEach((line, i) => {
        line.classList.remove('active', 'completed');
        const leftStage = i + 1;
        if (leftStage < currentStage) {
            line.classList.add('active');
        }
    });
}

function switchStage(stage) {
    if (stage < 1 || stage > 5) return;

    currentStage = stage;

    // 隐藏所有阶段面板
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`stagePanel${i}`).style.display = 'none';
    }

    // 显示当前阶段
    document.getElementById(`stagePanel${stage}`).style.display = 'block';
    updateProgressBar();

    // 阶段5：如果跳过阶段4，隐藏参考图像选项
    if (stage === 5) {
        const useImagesLabel = document.getElementById('useImagesLabel');
        if (stage4Skipped) {
            useImagesLabel.style.display = 'none';
            document.getElementById('refImageSection').style.display = 'none';
            document.getElementById('useImages').checked = false;
        } else {
            useImagesLabel.style.display = 'flex';
            toggleRefImage();
        }
    }

    // 滚动到顶部
    document.getElementById('workflowView').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ========== 项目管理 ==========

async function createProject() {
    const name = document.getElementById('projectName').value.trim();
    if (!name) { showError('请输入项目名称'); return; }
    showLoading('创建项目中...');
    try {
        const result = await apiCall('/api/project/create', 'POST', { name });
        currentProject = name;
        currentStage = 1;
        stage4Skipped = false;
        stageCompletion = {};
        uploadedAssets = { characters: null, scenes: null, props: null };
        uploadedScriptContent = null;

        showWorkflowView(name);
        switchStage(1);
        showSuccess(`项目 "${name}" 创建成功`);
        loadProjects();
    } catch (e) { showError(e.message); }
    finally { hideLoading(); }
}

async function loadProjects() {
    try {
        const result = await apiCall('/api/projects');
        const list = document.getElementById('projectList');
        list.innerHTML = '';

        if (!result.projects || result.projects.length === 0) {
            list.innerHTML = '<p class="empty-hint">暂无项目，输入名称创建一个吧</p>';
            return;
        }

        result.projects.forEach(project => {
            const card = document.createElement('div');
            card.className = `project-card ${project.name === currentProject ? 'active' : ''}`;
            const stageNames = { stage1:'剧本', stage2:'分镜脚本', stage3:'资产', stage4:'分镜', stage5:'成片' };
            const label = stageNames[project.current_stage] || '未开始';

            card.innerHTML = `
                <div class="card-body">
                    <h4>${project.name}</h4>
                    <p>阶段: ${label}</p>
                </div>
                <button class="btn-trash" title="删除项目" onclick="deleteProject(event, '${project.name}')">🗑️</button>
            `;

            card.onclick = (e) => {
                if (e.target.closest('.btn-trash')) return;
                selectProject(project.name);
            };
            list.appendChild(card);
        });
    } catch (error) {
        console.error('加载项目失败:', error);
        document.getElementById('projectList').innerHTML = '<p class="empty-hint">加载失败，请刷新重试</p>';
    }
}

async function deleteProject(event, name) {
    event.stopPropagation();
    if (!confirm(`确定要删除项目 "${name}" 吗？此操作不可恢复。`)) return;

    showLoading('删除项目中...');
    try {
        await apiCall(`/api/project/${name}`, 'DELETE');
        if (currentProject === name) {
            currentProject = null;
        }
        showSuccess(`项目 "${name}" 已删除`);
        loadProjects();
    } catch (e) { showError(e.message); }
    finally { hideLoading(); }
}

async function selectProject(name) {
    currentProject = name;
    currentStage = 1;
    stage4Skipped = false;
    stageCompletion = {};
    uploadedAssets = { characters: null, scenes: null, props: null };
    uploadedScriptContent = null;
    refImageData = null;
    document.getElementById('refImagePreview').innerHTML = '';
    document.getElementById('refImageName').textContent = '';
    document.getElementById('refImageUpload').value = '';

    showLoading('加载项目...');
    try {
        const status = await apiCall(`/api/project/${name}/status`);
        showWorkflowView(name);

        // 根据已完成阶段设置 stageCompletion
        if (status.stage1_complete) stageCompletion[1] = true;
        if (status.stage2_complete) stageCompletion[2] = true;
        if (status.stage3_complete) stageCompletion[3] = true;
        if (status.stage4_complete) stageCompletion[4] = true;
        if (status.stage5_complete) stageCompletion[5] = true;

        // 跳到当前进行中的阶段
        let nextStage = 1;
        if (status.stage1_complete && status.stage2_complete && status.stage3_complete && status.stage5_complete) {
            nextStage = 5;
        } else if (status.stage1_complete && status.stage2_complete && status.stage3_complete && status.stage4_complete) {
            nextStage = 5;
        } else if (status.stage1_complete && status.stage2_complete && status.stage3_complete) {
            nextStage = 4;
        } else if (status.stage1_complete && status.stage2_complete) {
            nextStage = 3;
        } else if (status.stage1_complete) {
            nextStage = 2;
        }

        switchStage(nextStage);
        loadProjects();
        showSuccess(`已加载: ${name}`);
    } catch (e) { showError(e.message); }
    finally { hideLoading(); }
}

// ========== 阶段一：剧本 ==========

function handleScriptUpload(input) {
    const file = input.files[0];
    if (!file) return;
    document.getElementById('scriptUploadName').textContent = file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedScriptContent = e.target.result;
        document.getElementById('ideaInput').value = uploadedScriptContent;
    };
    reader.readAsText(file);
}

async function generateScript() {
    if (!currentProject) { showError('请先选择项目'); return; }

    let idea = document.getElementById('ideaInput').value.trim();
    if (!idea && !uploadedScriptContent) { showError('请输入创意或上传剧本文件'); return; }

    const provider = document.getElementById('scriptProvider').value;

    showLoading('正在生成剧本...');
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage1/generate`, 'POST', {
            idea, style: '', provider, uploaded_content: uploadedScriptContent
        });
        document.getElementById('scriptDisplay').textContent = result.script;
        document.getElementById('scriptRevision').style.display = 'block';
        stageCompletion[1] = true;
        updateProgressBar();
        showSuccess('剧本生成成功!');
    } catch (e) { showError(e.message); }
    finally { hideLoading(); }
}

async function reviseScript() {
    if (!currentProject) return;
    const feedback = document.getElementById('scriptFeedback').value.trim();
    if (!feedback) { showError('请输入修改意见'); return; }
    showLoading('正在修改剧本...');
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage1/revise`, 'POST', { feedback });
        document.getElementById('scriptDisplay').textContent = result.script;
        document.getElementById('scriptFeedback').value = '';
        showSuccess('剧本修改成功!');
    } catch (e) { showError(e.message); }
    finally { hideLoading(); }
}

// ========== 阶段二：分镜脚本 ==========

async function generateStoryboard() {
    if (!currentProject) { showError('请先选择项目'); return; }
    const provider = document.getElementById('storyboardProvider').value;

    showLoading('正在生成分镜脚本...');
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage2/generate`, 'POST', { style: '', provider });
        displayStoryboard(result.storyboard);
        document.getElementById('storyboardRevision').style.display = 'block';
        stageCompletion[2] = true;
        updateProgressBar();
        showSuccess('分镜脚本生成成功!');
    } catch (e) { showError(e.message); }
    finally { hideLoading(); }
}

async function reviseStoryboard() {
    if (!currentProject) return;
    const feedback = document.getElementById('storyboardFeedback').value.trim();
    if (!feedback) { showError('请输入修改意见'); return; }
    showLoading('正在修改分镜脚本...');
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage2/revise`, 'POST', { feedback });
        displayStoryboard(result.storyboard);
        document.getElementById('storyboardFeedback').value = '';
        showSuccess('分镜脚本修改成功!');
    } catch (e) { showError(e.message); }
    finally { hideLoading(); }
}

function displayStoryboard(storyboard) {
    const display = document.getElementById('storyboardDisplay');
    const shots = storyboard.shots || [];
    if (shots.length === 0) { display.textContent = JSON.stringify(storyboard, null, 2); return; }
    let html = '<table class="storyboard-table"><tr><th>镜头</th><th>场景</th><th>时长</th><th>运镜</th><th>光影</th><th>提示词</th></tr>';
    shots.forEach(shot => {
        html += `<tr><td class="shot-id">${shot.shot_id || ''}</td><td>${shot.scene || ''}</td><td>${shot.duration || ''}s</td><td>${shot.camera_movement || ''}</td><td>${shot.lighting || ''}</td><td class="prompt" title="${shot.ai_image_prompt || ''}">${(shot.ai_image_prompt || '').substring(0,80)}...</td></tr>`;
    });
    html += '</table>';
    display.innerHTML = html;
}

// ========== 阶段三：资产 ==========

// 模型 → 分辨率/尺寸 配置
const modelOptions = {
    'gpt-image-2': {
        resolutions: ['1k', '2k', '4k'],
        ratios: ['1:1', '3:2', '2:3', '4:3', '3:4', '9:16', '16:9']
    },
    'nano-banana': {
        resolutions: ['1k', '2k', '4k'],
        ratios: ['21:9', '16:9', '3:2', '4:3', '1:1', '4:5', '3:4', '2:3', '9:16']
    },
    'seedream-5': {
        resolutions: ['2k', '4k'],
        ratios: ['16:9', '4:3', '1:1', '3:4', '9:16', '2:3', '3:2', '21:9']
    }
};

function updateModelOptions(prefix) {
    const model = document.getElementById(prefix + 'Provider').value;
    const opts = modelOptions[model] || modelOptions['gpt-image-2'];
    
    const resSelect = document.getElementById(prefix + 'Resolution');
    resSelect.innerHTML = opts.resolutions.map(r => `<option value="${r}">${r.toUpperCase()}</option>`).join('');
    
    const ratioSelect = document.getElementById(prefix + 'Ratio');
    ratioSelect.innerHTML = opts.ratios.map(r => `<option value="${r}">${r}</option>`).join('');
}

function switchAssetTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.asset-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`${tab}-tab`).classList.add('active');
    // 找到被点击的按钮
    document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.textContent.trim() === ({characters:'角色',scenes:'场景',props:'道具'}[tab])) {
            b.classList.add('active');
        }
    });
}

// 风格预设数据
const stylePresets = {
    '3d_guochao': '3D动画风格，皮克斯风格，现代东方美学，高端CG渲染，次表面散射(SSS)，柔和影棚光，干净纹理，流体模拟',
    'ink_wash': '中国传统水墨画风格，水彩，泼墨，干湿笔触，留白意境，宣纸纹理，黑白淡彩，写意抽象，禅意氛围',
    'anime_cel': '日式动画风格，卡通阴影，新海诚风格，鲜艳清新色彩，清晰黑色轮廓线，硬边阴影，镜头光晕，高细节背景',
    'hyperreal': '电影级摄影，照片级写实，专业摄像质感，8k分辨率，电影景深，胶片颗粒，戏剧性布光，真实皮肤纹理，光线追踪，超写实',
    'pixel_art': '像素艺术风格，16位复古游戏美学，清晰像素点，锯齿边缘，有限色板，抖动算法，怀旧街机风格',
    '2d_chibi': '2D矢量插画，扁平Q版卡通风格，粗轮廓线，贴纸艺术，明亮纯色，简单图形，可爱夸张，矢量图形',
    'noir_film': '黑白黑色电影风格，复古摄影，高对比度，明暗对照法布光，重度胶片颗粒，戏剧性阴影，神秘氛围，1940年代电影质感',
    'handdrawn': '手绘素描风格，铅笔画，石墨线条，粗糙排线，单色，白纸背景，未完成艺术感，极简线稿'
};

function updateStylePrompt() {
    const selected = document.querySelector('#stylePresets input[name="stylePreset"]:checked');
    if (selected && selected.value && stylePresets[selected.value]) {
        document.getElementById('stylePromptCustom').value = stylePresets[selected.value];
    } else {
        document.getElementById('stylePromptCustom').value = '';
    }
}

function handleAssetUpload(type, input) {
    const file = input.files[0];
    if (!file) return;
    document.getElementById(`upload-name-${type}`).textContent = file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedAssets[type] = { name: file.name, data: e.target.result };
        const container = getAssetContainer(type);
        if (container) {
            const div = document.createElement('div');
            div.className = 'result-item success';
            div.innerHTML = `<img src="${e.target.result}" alt="uploaded"><p>上传: ${file.name}</p>`;
            container.prepend(div);
        }
    };
    reader.readAsDataURL(file);
}

async function generateAssets(type) {
    if (!currentProject) { showError('请先选择项目'); return; }
    const typeNames = { characters: '角色', scenes: '场景', props: '道具' };
    const typeName = typeNames[type] || type;
    const prefix = type === 'characters' ? 'char' : type === 'scenes' ? 'scene' : 'prop';
    const provider = document.getElementById(prefix + 'Provider').value;
    const stylePrompt = document.getElementById('stylePromptCustom').value.trim();
    const resolution = document.getElementById(prefix + 'Resolution')?.value || '2k';
    const ratio = document.getElementById(prefix + 'Ratio')?.value || '16:9';

    const payload = { asset_type: type, provider, style_prompt: stylePrompt, resolution, ratio };
    if (uploadedAssets[type]) {
        payload.uploaded_image = uploadedAssets[type].data;
    }

    showLoading(`正在生成${typeName}...`);
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage3/generate`, 'POST', payload);
        displayAssetResults(result.results, type);
        stageCompletion[3] = true;
        updateProgressBar();
        showSuccess(`${typeName}生成成功!`);
    } catch (e) { showError(e.message); }
    finally { hideLoading(); }
}

function getAssetContainer(type) {
    if (type === 'characters') return document.getElementById('charResults');
    if (type === 'scenes') return document.getElementById('sceneResults');
    return document.getElementById('propResults');
}

function displayAssetResults(results, type) {
    const container = getAssetContainer(type);
    if (!container) return;
    results.forEach(item => {
        const div = document.createElement('div');
        div.className = `result-item ${item.status}`;
        if (item.status === 'success' && item.filepath) {
            const filename = item.filepath.split('\\').pop().split('/').pop();
            div.innerHTML = `<img src="/api/output/images/${filename}" alt="${item.shot_id}"><p>${item.shot_id}</p>`;
        } else {
            div.innerHTML = `<p style="padding:40px 20px;">失败 ${item.shot_id}<br><small>${item.error || ''}</small></p>`;
        }
        container.prepend(div);
    });
}

// ========== 阶段四：分镜画面 ==========

function skipStage4() {
    stage4Skipped = true;
    stageCompletion[4] = true;
    document.getElementById('stagePanel4').style.display = 'none';
    document.getElementById('visualStoryboardDisplay').textContent = '';
    updateProgressBar();
    showSuccess('已跳过分镜阶段');
    currentStage = 5;
    switchStage(5);
}

async function generateVisualStoryboard() {
    if (!currentProject) { showError('请先选择项目'); return; }
    stage4Skipped = false;
    showLoading('正在生成分镜画面...');
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage4/generate`, 'POST', {});
        document.getElementById('visualStoryboardDisplay').textContent = JSON.stringify(result, null, 2);
        stageCompletion[4] = true;
        updateProgressBar();
        showSuccess('分镜画面生成成功!');
    } catch (e) { showError(e.message); }
    finally { hideLoading(); }
}

// ========== 阶段五：制作成片 ==========

// 视频模型配置
const videoModelConfig = {
    'seedance-2.0':       { minDur: 4, maxDur: 15, qualities: ['480p','720p','1080p','4k'], ratios: ['21:9','16:9','4:3','1:1','3:4','9:16'] },
    'seedance-2.0-fast':  { minDur: 4, maxDur: 15, qualities: ['480p','720p'], ratios: ['21:9','16:9','4:3','1:1','3:4','9:16'] },
    'seedance-2.0-mini':  { minDur: 4, maxDur: 15, qualities: ['480p','720p'], ratios: ['21:9','16:9','4:3','1:1','3:4','9:16'] },
    'keling-v3':          { minDur: 3, maxDur: 15, qualities: ['720p','1080p','4k'], ratios: ['16:9','1:1','9:16'] },
    'wan-2.7':            { minDur: 2, maxDur: 15, qualities: ['720p','1080p'], ratios: ['16:9','4:3','1:1','3:4','9:16'] }
};

function updateVideoOptions() {
    const model = document.getElementById('videoProvider').value;
    const cfg = videoModelConfig[model] || videoModelConfig['seedance-2.0'];
    
    const durSlider = document.getElementById('videoDuration');
    durSlider.min = cfg.minDur;
    durSlider.max = cfg.maxDur;
    durSlider.value = Math.min(durSlider.value, cfg.maxDur);
    updateDurationLabel();
    
    const qSelect = document.getElementById('videoQuality');
    qSelect.innerHTML = cfg.qualities.map(q => `<option value="${q}">${q.toUpperCase()}</option>`).join('');
    
    const rSelect = document.getElementById('videoRatio');
    rSelect.innerHTML = cfg.ratios.map(r => `<option value="${r}">${r}</option>`).join('');
}

function updateDurationLabel() {
    const val = document.getElementById('videoDuration').value;
    document.getElementById('durationLabel').textContent = val + '秒';
}

function toggleAudioOptions() {
    // no-op - hint removed
}

let refImageData = null;

function handleRefImage(input) {
    const file = input.files[0];
    if (!file) return;
    document.getElementById('refImageName').textContent = file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
        refImageData = e.target.result;
        document.getElementById('refImagePreview').innerHTML = `<img src="${e.target.result}" alt="reference">`;
    };
    reader.readAsDataURL(file);
}

function toggleRefImage() {
    const checked = document.getElementById('useImages').checked;
    document.getElementById('refImageSection').style.display = checked ? 'block' : 'none';
}

function toggleAudioSelects() {
    const skip = document.getElementById('skipAudio').checked;
    ['ttsProvider','musicProvider','sfxProvider'].forEach(id => {
        document.getElementById(id).disabled = skip;
        document.getElementById(id).style.opacity = skip ? '0.4' : '1';
    });
}

async function makeFilm() {
    if (!currentProject) { showError('请先选择项目'); return; }

    const outputName = document.getElementById('outputName').value.trim() || null;
    const useImages = document.getElementById('useImages').checked;
    const skipAudio = document.getElementById('skipAudio').checked;

    const providers = {
        video: document.getElementById('videoProvider').value,
        tts: skipAudio ? null : document.getElementById('ttsProvider').value,
        music: skipAudio ? null : document.getElementById('musicProvider').value,
        sfx: skipAudio ? null : document.getElementById('sfxProvider').value
    };

    const progressDiv = document.getElementById('filmProgress');
    progressDiv.style.display = 'block';
    progressDiv.innerHTML = '';

    // Step 1: 视频
    showLoading('步骤 1/3: 正在生成视频片段...');
    progressDiv.innerHTML += '<p>[1/3] 正在生成视频片段...</p>';
    try {
        const videoResult = await apiCall(`/api/project/${currentProject}/stage5a/generate`, 'POST', {
            use_images: useImages, provider: providers.video
        });
        const ok = videoResult.results.filter(r=>r.status==='success').length;
        progressDiv.innerHTML += '<p class="success">[1/3] 视频生成完毕!</p>';
        showSuccess(`视频: ${ok}/${videoResult.results.length} 完成`);
    } catch(e) {
        progressDiv.innerHTML += `<p class="error">[1/3] 失败: ${e.message}</p>`;
        hideLoading(); return;
    }

    // Step 2: 音频（可选）
    if (!skipAudio) {
        showLoading('步骤 2/3: 正在生成音频...');
        progressDiv.innerHTML += '<p>[2/3] 正在生成音频 (配音+音乐+音效)...</p>';
        try {
            await apiCall(`/api/project/${currentProject}/stage5b/generate`, 'POST', {
                tts_provider: providers.tts, music_provider: providers.music, sfx_provider: providers.sfx
            });
            progressDiv.innerHTML += '<p class="success">[2/3] 音频生成完毕!</p>';
        } catch(e) {
            progressDiv.innerHTML += `<p class="error">[2/3] 失败: ${e.message}</p>`;
            progressDiv.innerHTML += '<p>音频失败，继续合成视频...</p>';
        }
    } else {
        progressDiv.innerHTML += '<p>[2/3] 已跳过音频</p>';
    }

    // Step 3: 合成
    showLoading('步骤 3/3: 正在合成最终成片...');
    progressDiv.innerHTML += '<p>[3/3] 正在合成最终成片...</p>';
    try {
        const finalResult = await apiCall(`/api/project/${currentProject}/stage5c/compose`, 'POST', {
            output_name: outputName, skip_audio: skipAudio
        });
        const container = document.getElementById('finalResult');
        const filename = finalResult.final_video.split('\\').pop().split('/').pop();
        container.innerHTML = `<h3>🎉 成片完成!</h3>
            <video controls width="100%">
                <source src="/api/project/${currentProject}/files/${filename}" type="video/mp4">
            </video><p>${finalResult.final_video}</p>`;
        stageCompletion[5] = true;
        updateProgressBar();
        progressDiv.innerHTML += '<p class="success">[3/3] 成片制作完成!</p>';
        showSuccess('最终成片已就绪!');
    } catch(e) {
        progressDiv.innerHTML += `<p class="error">[3/3] 失败: ${e.message}</p>`;
    }
    hideLoading();
}

// ========== 对话 ==========

let chatHistory = [];
const CHAT_STORAGE_KEY = 'ai_film_chat_history';

function saveChatHistory() {
    try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatHistory)); } catch(e) {}
}

function loadChatHistory() {
    try {
        const saved = localStorage.getItem(CHAT_STORAGE_KEY);
        if (saved) {
            chatHistory = JSON.parse(saved);
            const container = document.getElementById('chatMessages');
            container.innerHTML = '';
            chatHistory.forEach(msg => {
                const role = msg.role === 'assistant' ? 'ai' : msg.role;
                addChatBubble(role, msg.content, false);
            });
        }
    } catch(e) { chatHistory = []; }
}

function clearChatHistory() {
    if (!confirm('确定要清空所有聊天记录吗？')) return;
    chatHistory = [];
    localStorage.removeItem(CHAT_STORAGE_KEY);
    document.getElementById('chatMessages').innerHTML = '';
    addChatBubble('ai', '嗨！我是璐子秦，你的AI影片助手 🎬<br>跟我说说你想做什么样的影片吧！', false);
}

function addChatBubble(role, content, save = true) {
    const container = document.getElementById('chatMessages');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    const html = content
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    bubble.innerHTML = `
        <div class="chat-avatar">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="chat-content">${html}</div>
    `;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

function quickChat(text) {
    document.getElementById('chatInput').value = text;
    sendChat();
}

async function sendChat() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    input.disabled = true;

    addChatBubble('user', message);
    chatHistory.push({ role: 'user', content: message });
    saveChatHistory();

    // 显示 typing 指示器
    const typingBubble = document.createElement('div');
    typingBubble.className = 'chat-bubble ai';
    typingBubble.id = 'typingBubble';
    typingBubble.innerHTML = `
        <div class="chat-avatar">🤖</div>
        <div class="chat-content typing"><span>.</span><span>.</span><span>.</span></div>
    `;
    document.getElementById('chatMessages').appendChild(typingBubble);
    document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;

    try {
        const result = await apiCall('/api/chat', 'POST', {
            messages: chatHistory,
            provider: 'kimi'
        });
        document.getElementById('typingBubble')?.remove();
        addChatBubble('ai', result.reply);
        chatHistory.push({ role: 'assistant', content: result.reply });
        saveChatHistory();
    } catch (e) {
        document.getElementById('typingBubble')?.remove();
        const msg = e.message;
        if (msg.includes('429') || msg.includes('限流') || msg.includes('Too Many')) {
            addChatBubble('ai', '⏳ 请求太频繁了，等10秒后自动重试...');
            chatHistory.pop();  // 移除刚才的用户消息
            setTimeout(() => {
                document.getElementById('chatInput').value = message;
                sendChat();
            }, 10000);
            input.disabled = false;
            return;
        }
        addChatBubble('ai', '😅 出错了：' + msg);
    }

    input.disabled = false;
    input.focus();
}

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', () => {
    // 如果聊天记录为空，显示欢迎语
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!saved) {
        addChatBubble('ai', '嗨！我是璐子秦，你的AI影片助手 🎬<br>跟我说说你想做什么样的影片，或者直接<a>创建项目</a>开始吧！', false);
    } else {
        loadChatHistory();
    }
    loadProjects();
    updateModelOptions('char');
    updateModelOptions('scene');
    updateModelOptions('prop');
    updateVideoOptions();
    updateDurationLabel();
});
