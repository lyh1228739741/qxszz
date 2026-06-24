/**
 * AI 影片工作流 - 5 阶段独立页面版 + 进度条
 */

let currentProject = null;
let currentStage = 1;
let uploadedScriptContent = null;
let uploadedAssets = { characters: [], scenes: [], props: [] };
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

async function apiCall(url, method = 'GET', data = null, longTimeout = false) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) options.body = JSON.stringify(data);
    if (longTimeout) {
        const controller = new AbortController();
        options.signal = controller.signal;
        setTimeout(() => controller.abort(), 180000); // 3分钟超时
    }
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
    // 不清空项目数据，只切换视图
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

    // 加载上一阶段成果
    if (stage >= 2 && currentProject) loadPrevStageContent(stage);

    // 阶段4：更新跳过按钮文字
    if (stage === 4) {
        const btn = document.getElementById('btnSkipStage4');
        btn.textContent = stage4Skipped ? '取消跳过，正常使用阶段四' : '跳过此阶段';
        btn.className = stage4Skipped ? 'btn-primary' : 'btn-skip';
    }

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

// 加载前一阶段成果到当前阶段展示
async function loadPrevStageContent(stage) {
    if (!currentProject) return;
    
    try {
        if (stage === 2) {
            // 阶段二顶部展示阶段一剧本
            const result = await apiCall(`/api/project/${currentProject}/stage1/script`);
            if (result.content) {
                let prev = document.getElementById('stage2PrevContent');
                if (!prev) {
                    prev = document.createElement('div'); prev.id = 'stage2PrevContent'; prev.className = 'prev-stage-content';
                    document.getElementById('stagePanel2').insertBefore(prev, document.getElementById('stagePanel2').firstChild);
                }
                prev.innerHTML = `<h3>📝 阶段一成果：剧本</h3><div class="display-area">${result.content.replace(/\n/g, '<br>')}</div>`;
                prev.style.display = 'block';
            }
        } else if (stage === 3) {
            // 阶段三：从分镜提取人物、场景、道具
            const result = await apiCall(`/api/project/${currentProject}/stage2/storyboard`);
            if (result.content) {
                const data = result.content;
                let shots = data.shots || [];
                const characters = data.characters || [];
                if (shots.length === 0 && data.scenes) {
                    data.scenes.forEach(sc => { if (sc.shots) shots = shots.concat(sc.shots); });
                }
                if (shots.length === 0) {
                    for (const key of Object.keys(data)) {
                        if (key.startsWith('scene_') && data[key].shots) shots = shots.concat(data[key].shots);
                    }
                }
                
                // 提取人物
                let charList = characters.map(c => typeof c === 'string' ? c : (c.name || c.description || '')).filter(Boolean);
                if (charList.length === 0) {
                    charList = [...new Set(shots.map(s => {
                        const desc = (s.description || '');
                        const match = desc.match(/[\u4e00-\u9fff]{2,4}(?=在|走进|看着|发现|拿起|打开)/);
                        return match ? match[0] : '';
                    }).filter(Boolean))];
                }
                
                // 提取场景
                const sceneList = [...new Set(shots.map(s => s.scene || s.description?.substring(0,20) || '').filter(Boolean))];
                
                // 提取道具（从描述中匹配常见物品）
                const propKeywords = ['面具','剑','刀','枪','书','电脑','手机','杯子','钥匙','地图','画','雕像','灯','箱子','门','窗','桌','椅','花','笔'];
                const propList = [...new Set(shots.flatMap(s => {
                    const desc = (s.description || '') + (s.ai_image_prompt || '');
                    return propKeywords.filter(kw => desc.includes(kw));
                }))];
                
                // 渲染到可编辑列表
                if (charList.length || sceneList.length || propList.length) {
                    let prev = document.getElementById('stage3PrevContent');
                    if (!prev) {
                        prev = document.createElement('div'); prev.id = 'stage3PrevContent'; prev.className = 'prev-stage-content';
                        const panel = document.getElementById('stagePanel3');
                        panel.insertBefore(prev, panel.querySelector('.style-presets'));
                    }
                    prev.innerHTML = `
                        <h3>🎬 阶段二提取：人物 / 场景 / 道具</h3>
                        <div class="extract-grid">
                            <div class="extract-col"><strong>👤 人物</strong><textarea id="extractedChars" rows="5">${charList.join('\n')}</textarea></div>
                            <div class="extract-col"><strong>🏞️ 场景</strong><textarea id="extractedScenes" rows="5">${sceneList.join('\n')}</textarea></div>
                            <div class="extract-col"><strong>🔧 道具</strong><textarea id="extractedProps" rows="5">${propList.join('\n')}</textarea></div>
                        </div>
                        <button onclick="applyExtractedToAssets()" class="btn-secondary" style="margin-top:8px">✅ 应用这些数据到资产生成</button>
                    `;
                    prev.style.display = 'block';
                }
            }
        } else if (stage === 4) {
            // 阶段四：展示完整分镜
            const result = await apiCall(`/api/project/${currentProject}/stage2/storyboard`);
            if (result.content) {
                let shots = result.content.shots || [];
                if (shots.length === 0 && result.content.scenes) {
                    result.content.scenes.forEach(sc => { if (sc.shots) shots = shots.concat(sc.shots); });
                }
                if (shots.length === 0) {
                    for (const key of Object.keys(result.content)) {
                        if (key.startsWith('scene_') && result.content[key].shots) shots = shots.concat(result.content[key].shots);
                    }
                }
                if (shots.length > 0) {
                    let prev = document.getElementById('stage4PrevContent');
                    if (!prev) {
                        prev = document.createElement('div'); prev.id = 'stage4PrevContent'; prev.className = 'prev-stage-content';
                        document.getElementById('stagePanel4').insertBefore(prev, document.getElementById('stagePanel4').firstChild);
                    }
                    let html = `<h3>🎬 分镜脚本（${shots.length}个镜头）</h3><table class="storyboard-table"><tr><th>#</th><th>场景</th><th>时长</th><th>运镜</th><th>光影</th></tr>`;
                    shots.forEach(s => {
                        html += `<tr><td>${s.shot_id||''}</td><td>${s.scene||s.description?.substring(0,20)||''}</td><td>${s.duration||''}s</td><td>${s.camera_movement||''}</td><td>${(s.lighting||'').substring(0,30)}</td></tr>`;
                    });
                    html += '</table>';
                    prev.innerHTML = html;
                    prev.style.display = 'block';
                }
            }
        } else if (stage === 5) {
            // 阶段五：根据是否跳过阶段4展示不同内容
            let prev = document.getElementById('stage5PrevContent');
            if (!prev) {
                prev = document.createElement('div'); prev.id = 'stage5PrevContent'; prev.className = 'prev-stage-content';
                document.getElementById('stagePanel5').insertBefore(prev, document.getElementById('stagePanel5').firstChild);
            }
            if (stage4Skipped) {
                prev.innerHTML = '<h3>🎨 阶段三资产 → 成片参考</h3><p class="stage-desc">已跳过阶段四，将直接使用阶段三生成的资产制作成片。</p>';
            } else {
                prev.innerHTML = '<h3>🖼️ 阶段四分镜 → 成片参考</h3><p class="stage-desc">将基于阶段四的分镜画面制作成片。</p>';
            }
            prev.style.display = 'block';
        }
    } catch(e) { /* 静默失败 */ }
}

function applyExtractedToAssets() {
    // 不做复杂处理，数据已经在文本框里可编辑
    showSuccess('数据已加载，可编辑后用于资产生成');
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
        uploadedAssets = { characters: [], scenes: [], props: [] };
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
    uploadedAssets = { characters: [], scenes: [], props: [] };
    uploadedScriptContent = null;
    refImageData = [];
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
        // 加载各阶段已有成果
        if (nextStage >= 2) loadPrevStageContent(nextStage);
        // 如果阶段一已完成，加载剧本到文本框
        if (stageCompletion[1]) {
            try {
                const scr = await apiCall(`/api/project/${name}/stage1/script`);
                if (scr.content) {
                    uploadedScriptContent = scr.content;
                    document.getElementById('ideaInput').value = scr.content;
                    document.getElementById('btnSkipScript').style.display = 'inline-block';
                    document.getElementById('btnRemoveScript').style.display = 'inline-block';
                    document.getElementById('btnGenerateScript').textContent = '重新生成剧本';
                    document.getElementById('scriptUploadName').textContent = '(已保存)';
                }
            } catch(e) {}
        }
        loadProjects();
        showSuccess(`已加载: ${name}`);
    } catch (e) { showError(e.message); }
    finally { hideLoading(); }
}

// ========== 阶段一：剧本 ==========

function handleScriptUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const name = file.name.toLowerCase();
    document.getElementById('scriptUploadName').textContent = file.name;
    document.getElementById('btnRemoveScript').style.display = 'inline-block';
    document.getElementById('btnSkipScript').style.display = 'inline-block';
    document.getElementById('btnGenerateScript').textContent = '重新生成剧本';
    
    const setContent = (text) => {
        uploadedScriptContent = text;
        document.getElementById('ideaInput').value = text;
    };
    
    if (name.endsWith('.docx')) {
        // 使用 mammoth.js 解析 docx
        const reader = new FileReader();
        reader.onload = function(e) {
            mammoth.extractRawText({ arrayBuffer: e.target.result })
                .then(result => setContent(result.value))
                .catch(err => {
                    showError('DOCX 解析失败: ' + err.message);
                    removeScriptUpload();
                });
        };
        reader.readAsArrayBuffer(file);
    } else if (name.endsWith('.doc')) {
        // .doc 旧格式尝试作为文本读取（可能部分乱码但能提取出文字）
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            // 过滤明显的乱码字符
            const cleaned = text.replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u30ff\uff00-\uffef\n\r\t]/g, '');
            if (cleaned.trim().length < 10) {
                showError('.doc 文件解析失败，建议转为 .docx 或 .txt 格式上传');
                removeScriptUpload();
            } else {
                setContent(cleaned);
            }
        };
        reader.readAsText(file, 'UTF-8');
    } else {
        // .txt .md 直接读取
        const reader = new FileReader();
        reader.onload = function(e) {
            setContent(e.target.result);
        };
        reader.readAsText(file, 'UTF-8');
    }
}

function removeScriptUpload() {
    uploadedScriptContent = null;
    document.getElementById('scriptUploadName').textContent = '';
    document.getElementById('btnRemoveScript').style.display = 'none';
    document.getElementById('btnSkipScript').style.display = 'none';
    document.getElementById('btnGenerateScript').textContent = '生成剧本';
    document.getElementById('scriptFileUpload').value = '';
    document.getElementById('ideaInput').value = '';
}

async function skipScriptGeneration() {
    if (!currentProject) { showError('请先选择项目'); return; }
    if (!uploadedScriptContent) { showError('请先上传剧本文件'); return; }
    
    showLoading('保存剧本中...');
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage1/skip`, 'POST', {
            content: uploadedScriptContent
        });
        stageCompletion[1] = true;
        updateProgressBar();
        showSuccess('剧本已保存，进入阶段二');
        switchStage(2);
    } catch (e) { showError(e.message); }
    finally { hideLoading(); }
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
        }, true);
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
    
    // 检查阶段一是否完成
    if (!stageCompletion[1]) {
        showError('请先生成阶段一的剧本，再进入阶段二');
        switchStage(1);
        return;
    }
    
    const provider = document.getElementById('storyboardProvider').value;

    showLoading('正在生成分镜脚本（可能需要30秒）...');
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage2/generate`, 'POST', { style: '', provider }, true);
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
    
    // 提取所有镜头（支持三种格式）
    let shots = storyboard.shots || [];
    if (shots.length === 0 && storyboard.scenes) {
        // 格式: { scenes: [{ shots: [...] }] }
        storyboard.scenes.forEach(sc => {
            if (sc.shots) shots = shots.concat(sc.shots);
        });
    }
    if (shots.length === 0) {
        // 格式: { scene_01: { shots: [...] }, scene_02: ... }
        for (const key of Object.keys(storyboard)) {
            if (key.startsWith('scene_') && storyboard[key].shots) {
                shots = shots.concat(storyboard[key].shots);
            }
        }
    }
    
    if (shots.length === 0) { display.textContent = JSON.stringify(storyboard, null, 2); return; }
    
    let html = '<table class="storyboard-table"><tr><th>镜头</th><th>场景</th><th>时长</th><th>运镜</th><th>构图</th><th>光影</th><th>AI提示词</th></tr>';
    shots.forEach(shot => {
        const prompt = shot.ai_image_prompt || '';
        html += `<tr>
            <td class="shot-id">${shot.shot_id || ''}</td>
            <td>${shot.scene || shot.description || ''}</td>
            <td>${shot.duration || ''}s</td>
            <td>${shot.camera_movement || ''}</td>
            <td>${shot.composition || shot.camera_height || ''}</td>
            <td>${(shot.lighting || '').substring(0,40)}</td>
            <td class="prompt" title="${prompt}">${prompt.substring(0,60)}...</td>
        </tr>`;
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
    const files = input.files;
    if (!files.length) return;
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const id = Date.now() + Math.random();
            uploadedAssets[type].push({ id, name: file.name, data: e.target.result });
            
            const container = getAssetContainer(type);
            if (container) {
                const div = document.createElement('div');
                div.className = 'result-item success uploaded-item';
                div.id = `upload-${id}`;
                div.innerHTML = `
                    <button class="btn-img-delete" onclick="removeUploadedAsset('${type}', '${id}')">×</button>
                    <img src="${e.target.result}" alt="uploaded">
                    <p>${file.name}</p>
                `;
                container.prepend(div);
            }
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function removeUploadedAsset(type, id) {
    const idx = uploadedAssets[type].findIndex(a => String(a.id) === String(id));
    if (idx >= 0) uploadedAssets[type].splice(idx, 1);
    const el = document.getElementById(`upload-${id}`);
    if (el) el.remove();
}

async function generateAssets(type) {
    if (!currentProject) { showError('请先选择项目'); return; }
    
    if (!stageCompletion[2]) {
        showError('请先生成阶段二的分镜脚本，再进入阶段三');
        switchStage(2);
        return;
    }
    
    const typeNames = { characters: '角色', scenes: '场景', props: '道具' };
    const typeName = typeNames[type] || type;
    const prefix = type === 'characters' ? 'char' : type === 'scenes' ? 'scene' : 'prop';
    const provider = document.getElementById(prefix + 'Provider').value;
    const stylePrompt = document.getElementById('stylePromptCustom').value.trim();
    const resolution = document.getElementById(prefix + 'Resolution')?.value || '2k';
    const ratio = document.getElementById(prefix + 'Ratio')?.value || '16:9';

    const payload = { asset_type: type, provider, style_prompt: stylePrompt, resolution, ratio };
    if (uploadedAssets[type] && uploadedAssets[type].length > 0) {
        payload.uploaded_images = uploadedAssets[type].map(a => a.data);
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
    if (stage4Skipped) {
        // 取消跳过
        stage4Skipped = false;
        stageCompletion[4] = false;
        updateProgressBar();
        showSuccess('已取消跳过，现在可以正常使用阶段四');
        return;
    }
    stage4Skipped = true;
    stageCompletion[4] = true;
    updateProgressBar();
    showSuccess('已跳过分镜阶段，可在阶段四取消');
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

let refImageData = [];

function handleRefImage(input) {
    const files = input.files;
    if (!files.length) return;
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const id = Date.now() + Math.random();
            refImageData.push({ id, name: file.name, data: e.target.result });
            const preview = document.getElementById('refImagePreview');
            const div = document.createElement('div');
            div.className = 'ref-img-item';
            div.id = `ref-${id}`;
            div.innerHTML = `
                <button class="btn-img-delete" onclick="removeRefImage('${id}')">×</button>
                <img src="${e.target.result}" alt="ref">
                <span>${file.name}</span>
            `;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function removeRefImage(id) {
    refImageData = refImageData.filter(a => String(a.id) !== String(id));
    const el = document.getElementById(`ref-${id}`);
    if (el) el.remove();
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

// ========== 多镜头视频生成 ==========

let videoShots = [];

async function loadShotList() {
    if (!currentProject) { showError('请先选择项目'); return; }
    
    showLoading('加载分镜数据...');
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage2/storyboard`);
        let shots = result.content?.shots || [];
        if (shots.length === 0 && result.content?.scenes) {
            result.content.scenes.forEach(sc => { if (sc.shots) shots = shots.concat(sc.shots); });
        }
        if (shots.length === 0) {
            for (const key of Object.keys(result.content || {})) {
                if (key.startsWith('scene_') && result.content[key].shots) shots = shots.concat(result.content[key].shots);
            }
        }
        
        if (shots.length === 0) { showError('没有找到分镜数据，请先生成阶段二的分镜'); return; }
        
        videoShots = shots.map((s, i) => ({
            ...s,
            index: i,
            shotId: s.shot_id || `shot_${i+1}`,
            status: 'pending',
            videoUrl: null
        }));
        
        renderShotCards();
        document.getElementById('shotListTitle').textContent = `🎬 镜头列表（${videoShots.length}个镜头）`;
        showSuccess(`已加载 ${videoShots.length} 个镜头`);
    } catch(e) { showError(e.message); }
    finally { hideLoading(); }
}

function renderShotCards() {
    const container = document.getElementById('shotList');
    container.innerHTML = videoShots.map((shot, i) => {
        const desc = (shot.description || shot.ai_image_prompt || '').substring(0, 60);
        const statusIcon = { pending: '⏳', generating: '🔄', done: '✅', failed: '❌' }[shot.status] || '⏳';
        return `
        <div class="shot-card" id="shotCard${i}">
            <div class="shot-card-header">
                <span class="shot-card-id">${statusIcon} ${shot.shotId}</span>
                <span class="shot-card-desc">${desc}</span>
            </div>
            <div class="shot-card-body">
                <div class="shot-card-controls">
                    <div><label>时长</label>
                        <input type="range" id="shotDur${i}" min="2" max="15" value="5" oninput="document.getElementById('shotDurLabel${i}').textContent=this.value+'s'">
                        <span id="shotDurLabel${i}">5s</span>
                    </div>
                </div>
                ${shot.status === 'done' && shot.videoUrl ? `<video src="${shot.videoUrl}" controls class="shot-video"></video>` : ''}
                <button onclick="generateShot(${i})" class="btn-primary" ${shot.status === 'done' ? 'disabled' : ''}>
                    ${shot.status === 'done' ? '已生成 ✓' : shot.status === 'generating' ? '生成中...' : '生成此镜头'}
                </button>
            </div>
        </div>`;
    }).join('');
}

async function generateShot(index) {
    if (!currentProject) return;
    const shot = videoShots[index];
    if (!shot) return;
    
    shot.status = 'generating';
    renderShotCards();
    
    showLoading(`生成镜头 ${shot.shotId}...`);
    try {
        const result = await apiCall(`/api/project/${currentProject}/stage5a/generate`, 'POST', {
            use_images: document.getElementById('useImages').checked,
            shots: [{ shot_id: shot.shotId, prompt: shot.ai_video_prompt || shot.ai_image_prompt }],
            provider: document.getElementById('videoProvider').value
        }, true);
        
        if (result.results && result.results[0]) {
            const r = result.results[0];
            if (r.status === 'success' && r.filepath) {
                shot.status = 'done';
                const filename = r.filepath.split('\\').pop().split('/').pop();
                shot.videoUrl = `/api/project/${currentProject}/files/${filename}`;
            } else {
                shot.status = 'failed';
            }
        }
    } catch(e) {
        shot.status = 'failed';
    }
    
    renderShotCards();
    hideLoading();
}

async function combineFilm() {
    if (!currentProject) { showError('请先选择项目'); return; }
    
    const progressDiv = document.getElementById('filmProgress');
    progressDiv.style.display = 'block';
    progressDiv.innerHTML = '<p>正在合成最终成片...</p>';
    
    const outputName = document.getElementById('outputName').value.trim() || null;
    const skipAudio = document.getElementById('skipAudio').checked;
    
    try {
        const finalResult = await apiCall(`/api/project/${currentProject}/stage5c/compose`, 'POST', {
            output_name: outputName, skip_audio: skipAudio
        }, true);
        const container = document.getElementById('finalResult');
        const filename = finalResult.final_video.split('\\').pop().split('/').pop();
        container.innerHTML = `<h3>🎉 成片完成!</h3>
            <video controls width="100%">
                <source src="/api/project/${currentProject}/files/${filename}" type="video/mp4">
            </video><p>${finalResult.final_video}</p>`;
        stageCompletion[5] = true;
        updateProgressBar();
        progressDiv.innerHTML += '<p class="success">成片制作完成!</p>';
    } catch(e) {
        progressDiv.innerHTML += `<p class="error">失败: ${e.message}</p>`;
    }
}

// 保留旧 makeFilm 兼容
async function makeFilm() {
    await loadShotList();
    if (videoShots.length === 0) return;
    // 逐个生成
    for (let i = 0; i < videoShots.length; i++) {
        if (videoShots[i].status === 'pending') {
            await generateShot(i);
            if (videoShots[i].status === 'failed') break;
        }
    }
    await combineFilm();
}
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
