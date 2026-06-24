/**
 * AI 影片工作流 - 5 阶段中文版
 */

let currentProject = null;
let uploadedScriptContent = null;
let uploadedAssets = { characters: null, scenes: null, props: null };
let stage4Skipped = false;

// ========== 工具 ==========

function log(message, type = 'info') {
    const logDisplay = document.getElementById('logDisplay');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${message}`;
    logDisplay.appendChild(entry);
    logDisplay.scrollTop = logDisplay.scrollHeight;
}

function showLoading(text = '处理中...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loading').style.display = 'flex';
}
function hideLoading() { document.getElementById('loading').style.display = 'none'; }

function showError(message) { log(message, 'error'); alert('错误: ' + message); }
function showSuccess(message) { log(message, 'success'); }

async function apiCall(url, method = 'GET', data = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) options.body = JSON.stringify(data);
    try {
        const response = await fetch(url, options);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
        return result;
    } catch (error) { showError(error.message); throw error; }
}

// ========== 视图切换 ==========

function showHomeView() {
    document.getElementById('homeView').style.display = 'block';
    document.getElementById('workflowView').style.display = 'none';
    document.querySelector('.log-section').style.display = 'block';
    currentProject = null;
    loadProjects();
}

function showWorkflowView(projectName) {
    document.getElementById('homeView').style.display = 'none';
    document.getElementById('workflowView').style.display = 'block';
    document.querySelector('.log-section').style.display = 'block';
    document.getElementById('workflowProjectTitle').textContent = `🎬 ${projectName}`;
}

function goBackHome() {
    if (currentProject) {
        log(`离开项目: ${currentProject}`);
    }
    currentProject = null;
    stage4Skipped = false;
    uploadedAssets = { characters: null, scenes: null, props: null };
    uploadedScriptContent = null;
    document.getElementById('scriptDisplay').textContent = '';
    document.getElementById('scriptRevision').style.display = 'none';
    document.getElementById('scriptFeedback').value = '';
    document.getElementById('storyboardDisplay').textContent = '';
    document.getElementById('storyboardRevision').style.display = 'none';
    document.getElementById('storyboardFeedback').value = '';
    document.getElementById('assetResults').innerHTML = '';
    document.getElementById('visualStoryboardDisplay').textContent = '';
    document.getElementById('finalResult').innerHTML = '';
    document.getElementById('filmProgress').style.display = 'none';
    document.getElementById('filmProgress').innerHTML = '';
    showHomeView();
}

// ========== 项目管理 ==========

async function createProject() {
    const name = document.getElementById('projectName').value.trim();
    if (!name) { showError('请输入项目名称'); return; }
    showLoading('创建项目中...');
    try {
        const result = await apiCall('/api/project/create', 'POST', { name });
        currentProject = name;
        stage4Skipped = false;
        uploadedAssets = { characters: null, scenes: null, props: null };
        uploadedScriptContent = null;
        showWorkflowView(name);
        updateStatus(result.status);
        showSuccess(`项目 "${name}" 创建成功`);
        loadProjects();
    } finally { hideLoading(); }
}

async function loadProjects() {
    try {
        const result = await apiCall('/api/projects');
        const list = document.getElementById('projectList');
        list.innerHTML = '';
        if (result.projects.length === 0) {
            list.innerHTML = '<p style="color:#888;text-align:center;padding:30px;">暂无项目，输入名称创建一个吧</p>';
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
                // 不触发回收站按钮的 click
                if (e.target.closest('.btn-trash')) return;
                selectProject(project.name);
            };
            list.appendChild(card);
        });
    } catch (error) { console.error('加载项目失败:', error); }
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
    } finally { hideLoading(); }
}

async function selectProject(name) {
    currentProject = name;
    stage4Skipped = false;
    showLoading('加载项目...');
    try {
        const status = await apiCall(`/api/project/${name}/status`);
        showWorkflowView(name);
        updateStatus(status);
        loadProjects();
        log(`切换到: ${name}`);
    } finally { hideLoading(); }
}

function updateStatus(status) {
    const display = document.getElementById('statusDisplay');
    const stages = [
        { key: 'stage1_complete', label: '剧本', stageId: 'stage1', statusText: status.stage1_complete ? '完成' : '待完成' },
        { key: 'stage2_complete', label: '分镜脚本', stageId: 'stage2', statusText: status.stage2_complete ? '完成' : '待完成' },
        { key: 'stage3_complete', label: '资产', stageId: 'stage3', statusText: status.stage3_complete ? `完成 (${status.stage3_images_count}张)` : '待完成' },
        { key: 'stage4_complete', label: '分镜', stageId: 'stage4', statusText: stage4Skipped ? '已跳过' : (status.stage4_complete ? '完成' : '待完成') },
        { key: 'stage5_complete', label: '成片', stageId: 'stage5', statusText: status.stage5_complete ? '完成' : '待完成' },
    ];

    display.innerHTML = stages.map((s, i) => {
        let cssClass = 'pending';
        if (s.statusText === '完成' || s.statusText.startsWith('完成')) cssClass = 'completed';
        else if (s.statusText === '已跳过') cssClass = 'pending';
        return `<div class="status-item ${cssClass}" onclick="scrollToStage('${s.stageId}')">
            <label>${s.label}</label>
            <span class="stage-status">${s.statusText}</span>
        </div>`;
    }).join('');
}

function scrollToStage(stageId) {
    const el = document.getElementById(stageId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
        log(`已上传剧本文件: ${file.name} (${(file.size/1024).toFixed(1)} KB)`);
    };
    reader.readAsText(file);
}

async function generateScript() {
    if (!currentProject) { showError('请先选择项目'); return; }

    let idea = document.getElementById('ideaInput').value.trim();
    if (!idea && !uploadedScriptContent) { showError('请输入创意或上传剧本文件'); return; }

    const style = document.getElementById('styleInput').value;
    const provider = document.getElementById('scriptProvider').value;

    showLoading('正在生成剧本...');
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage1/generate`, 'POST', {
            idea, style, provider,
            uploaded_content: uploadedScriptContent
        });
        document.getElementById('scriptDisplay').textContent = result.script;
        document.getElementById('scriptRevision').style.display = 'block';
        updateStatus(result.status);
        showSuccess('剧本生成成功!');
    } finally { hideLoading(); }
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
        updateStatus(result.status);
        showSuccess('剧本修改成功!');
    } finally { hideLoading(); }
}

// ========== 阶段二：分镜脚本 ==========

async function generateStoryboard() {
    if (!currentProject) { showError('请先选择项目'); return; }
    const style = document.getElementById('visualStyle').value;
    const provider = document.getElementById('storyboardProvider').value;

    showLoading('正在生成分镜脚本...');
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage2/generate`, 'POST', { style, provider });
        displayStoryboard(result.storyboard);
        document.getElementById('storyboardRevision').style.display = 'block';
        updateStatus(result.status);
        showSuccess('分镜脚本生成成功!');
    } finally { hideLoading(); }
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
        updateStatus(result.status);
        showSuccess('分镜脚本修改成功!');
    } finally { hideLoading(); }
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

function switchAssetTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.asset-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
}

function handleAssetUpload(type, input) {
    const file = input.files[0];
    if (!file) return;
    document.getElementById(`upload-name-${type}`).textContent = file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedAssets[type] = { name: file.name, data: e.target.result };
        const container = document.getElementById('assetResults');
        const div = document.createElement('div');
        div.className = 'result-item success';
        div.innerHTML = `<img src="${e.target.result}" alt="uploaded"><p>上传: ${file.name}</p>`;
        container.prepend(div);
        log(`已上传${type === 'characters' ? '角色' : type === 'scenes' ? '场景' : '道具'}图片: ${file.name}`);
    };
    reader.readAsDataURL(file);
}

async function generateAssets(type) {
    if (!currentProject) { showError('请先选择项目'); return; }
    const typeNames = { characters: '角色', scenes: '场景', props: '道具' };
    const typeName = typeNames[type] || type;
    const provider = document.getElementById('imageProvider').value;

    const payload = { asset_type: type, provider };
    if (uploadedAssets[type]) {
        payload.uploaded_image = uploadedAssets[type].data;
    }

    showLoading(`正在生成${typeName}...`);
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage3/generate`, 'POST', payload);
        displayAssetResults(result.results);
        updateStatus(result.status);
        showSuccess(`${typeName}生成成功!`);
    } finally { hideLoading(); }
}

function displayAssetResults(results) {
    const container = document.getElementById('assetResults');
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

// ========== 阶段四：分镜（可选） ==========

function skipStage4() {
    stage4Skipped = true;
    log('已跳过阶段四：分镜');
    showSuccess('已跳过分镜阶段，可继续制作成片');
    apiCall(`/api/project/${currentProject}/status`).then(r => updateStatus(r));
}

async function generateVisualStoryboard() {
    if (!currentProject) { showError('请先选择项目'); return; }
    stage4Skipped = false;
    showLoading('正在生成分镜画面...');
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage4/generate`, 'POST', {});
        document.getElementById('visualStoryboardDisplay').textContent = JSON.stringify(result, null, 2);
        updateStatus(result.status);
        showSuccess('分镜画面生成成功!');
    } finally { hideLoading(); }
}

// ========== 阶段五：制作成片 ==========

function toggleAudioOptions() {
    const videoProvider = document.getElementById('videoProvider').value;
    const hint = document.getElementById('seedanceHint');
    const skipAudio = document.getElementById('skipAudio');
    if (videoProvider === 'seedance-2.0') {
        hint.style.display = 'block';
        skipAudio.parentElement.style.display = 'flex';
    } else {
        hint.style.display = 'none';
    }
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
        showSuccess(`视频: ${ok}/${videoResult.results.length} 完成`);
        progressDiv.innerHTML += '<p class="success">[1/3] 视频生成完毕!</p>';
        updateStatus(videoResult.status);
    } catch(e) {
        progressDiv.innerHTML += `<p class="error">[1/3] 失败: ${e.message}</p>`;
        hideLoading(); return;
    }

    // Step 2: 音频（可选）
    if (!skipAudio) {
        showLoading('步骤 2/3: 正在生成音频...');
        progressDiv.innerHTML += '<p>[2/3] 正在生成音频 (配音+音乐+音效)...</p>';
        try {
            const audioResult = await apiCall(`/api/project/${currentProject}/stage5b/generate`, 'POST', {
                tts_provider: providers.tts, music_provider: providers.music, sfx_provider: providers.sfx
            });
            showSuccess('音频生成完毕!');
            progressDiv.innerHTML += '<p class="success">[2/3] 音频生成完毕!</p>';
            updateStatus(audioResult.status);
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
        container.innerHTML = `<h3>成片完成!</h3>
            <video controls width="100%">
                <source src="/api/project/${currentProject}/files/${filename}" type="video/mp4">
            </video><p>${finalResult.final_video}</p>`;
        updateStatus(finalResult.status);
        progressDiv.innerHTML += '<p class="success">[3/3] 成片制作完成!</p>';
        showSuccess('最终成片已就绪!');
    } catch(e) {
        progressDiv.innerHTML += `<p class="error">[3/3] 失败: ${e.message}</p>`;
    }
    hideLoading();
}

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', () => {
    log('AI 影片工作流已就绪');
    log('请创建或选择一个项目开始');
    loadProjects();
    toggleAudioOptions();
});
