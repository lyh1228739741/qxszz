# 🎬 AI 影片一键生成工作流

> 璐子秦出品 —— 有点傻但靠谱的 AI 影片工作流

## 工作流程

```
你的想法/创意
    ↓
【阶段1：剧本生成】← 你确认/修改
    ↓
【阶段2：分镜脚本】← 你确认/修改（含镜头语言、光影描述）
    ↓
【阶段3：视觉生成】← 图片/视频帧生成
    ↓
【阶段4：视频生成】← 动态视频片段
    ↓
【阶段5：音频生成】← 配音+配乐+音效
    ↓
【阶段6：后期合成】← FFmpeg 剪辑成片
    ↓
成片输出 🎉
```

## 技术栈

| 环节 | API |
|------|-----|
| 剧本/脚本 | GPT-4o / Kimi |
| 图像生成 | GPT-image-2 |
| 视频生成 | Seedance 2.0 |
| 语音/TTS | MiniMax |
| 音乐 | Suno |
| 音效 | Noiz |
| 后期剪辑 | FFmpeg |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置 API Key

复制配置文件模板：

```bash
cp src/config/api_config.py src/config/api_config_local.py
```

编辑 `src/config/api_config_local.py`，填入你的 API Key。

### 3. 运行工作流

```bash
cd src
python workflow.py
```

按提示输入项目名称和创意，然后按阶段推进。

## 项目结构

```
ai-film-workflow/
├── src/
│   ├── config/
│   │   └── api_config.py          # API 配置模板
│   ├── stages/
│   │   ├── stage1_script.py       # 剧本生成
│   │   ├── stage2_storyboard.py   # 分镜脚本
│   │   ├── stage3_image.py        # 图像生成
│   │   ├── stage4_video.py        # 视频生成
│   │   ├── stage5_audio.py        # 音频生成
│   │   └── stage6_edit.py         # 后期合成
│   ├── utils/
│   │   └── base_api.py            # API 客户端基类
│   └── workflow.py                # 主控流程 + CLI
├── output/                        # 输出目录
│   ├── scripts/                   # 剧本
│   ├── images/                    # 图像
│   ├── videos/                    # 视频片段
│   ├── audio/                     # 音频
│   └── final/                     # 最终成片
├── projects/                      # 项目工作区
├── prompts/                       # 提示词模板
├── requirements.txt
└── README.md
```

## 使用流程

### 阶段1：剧本生成

1. 输入你的创意/想法
2. AI 生成完整剧本（含角色、场景、对白）
3. 查看剧本，不满意可以修改

### 阶段2：分镜脚本

1. 基于确认的剧本生成分镜
2. 每个镜头包含：构图、运镜、光影、AI 提示词
3. 查看分镜，不满意可以修改

### 阶段3：图像生成

1. 根据分镜中的提示词生成静态图像
2. 用于角色、道具、场景参考
3. 也可直接用于图生视频

### 阶段4：视频生成

1. 根据分镜生成动态视频片段
2. 支持使用阶段3的图像作为参考
3. Seedance 2.0 负责镜头运动和光影

### 阶段5：音频生成

1. MiniMax 生成对白配音
2. Suno 生成背景音乐
3. Noiz 生成音效

### 阶段6：后期合成

1. FFmpeg 拼接所有视频片段
2. 混合音轨（对白+音乐+音效）
3. 输出最终成片

## 注意事项

- 每个阶段完成后会保存状态，可以随时中断和恢复
- 项目文件保存在 `projects/{项目名称}/` 目录
- API Key 不要提交到代码仓库
- 视频生成耗时较长，请耐心等待

## TODO

- [ ] 添加更多视频转场效果
- [ ] 支持自定义字幕样式
- [ ] 添加 LUT 调色支持
- [ ] 实现智能时间线对齐
- [ ] 添加批量项目管理
- [ ] Web UI 界面

---

*Powered by 璐子秦 🤖*
