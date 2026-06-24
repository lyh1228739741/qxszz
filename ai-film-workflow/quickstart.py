"""
快速启动脚本 - 一行命令跑完整流程
用于测试和演示
"""

import sys
import os

# 添加 src 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from workflow import AIFilmWorkflow


def quick_test():
    """快速测试 - 使用模拟数据"""
    print("🎬 AI 影片工作流 - 快速测试")
    print("=" * 50)
    
    # 创建项目
    workflow = AIFilmWorkflow("test_project")
    
    # 检查当前状态
    workflow.print_status()
    
    print("\n📋 测试流程:")
    print("1. 先生成剧本（需要 GPT/Kimi API Key）")
    print("2. 确认剧本后生成分镜")
    print("3. 确认分镜后生成图像/视频")
    print("4. 生成音频")
    print("5. 合成成片")
    print("\n使用: python src/workflow.py 进入交互模式")


def demo_workflow():
    """演示完整工作流（需要所有 API Key）"""
    print("🎬 演示完整工作流")
    print("=" * 50)
    
    workflow = AIFilmWorkflow("demo_cyberpunk")
    
    # 示例创意
    idea = """
    一个赛博朋克风格的短片，时长约30秒。
    
    故事：在一个雨夜，一个废弃的机器人突然觉醒。
    它抬起头，看着周围霓虹闪烁的城市，开始质疑自己的存在。
    最后，它迈出第一步，走向未知的街道。
    
    风格参考：《银翼杀手2049》
    色调：冷色调，蓝紫色为主，霓虹灯反射
    """
    
    print("创意:")
    print(idea)
    
    try:
        # 阶段1：剧本
        print("\n🎬 阶段1: 生成剧本...")
        script = workflow.stage1_generate_script(idea, provider="openai")
        print("\n生成的剧本:")
        print(script[:500] + "...")
        
        # 等待用户确认
        input("\n按 Enter 确认剧本并继续...")
        
        # 阶段2：分镜
        print("\n🎥 阶段2: 生成分镜...")
        storyboard = workflow.stage2_generate_storyboard(provider="openai")
        print(f"\n生成了 {len(storyboard.get('shots', []))} 个镜头")
        
        input("\n按 Enter 确认分镜并继续...")
        
        # 阶段3：图像
        print("\n🎨 阶段3: 生成图像...")
        images = workflow.stage3_generate_images()
        print(f"\n生成了 {len(images)} 张图像")
        
        # 阶段4：视频
        print("\n🎬 阶段4: 生成视频...")
        videos = workflow.stage4_generate_videos()
        print(f"\n生成了 {len(videos)} 个视频片段")
        
        # 阶段5：音频
        print("\n🎵 阶段5: 生成音频...")
        audio = workflow.stage5_generate_audio()
        print("\n音频生成完成")
        
        # 阶段6：合成
        print("\n🎬 阶段6: 合成成片...")
        final = workflow.stage6_compose_final()
        print(f"\n✅ 成片已保存: {final}")
        
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="AI 影片工作流快速启动")
    parser.add_argument("--demo", action="store_true", help="运行完整演示")
    
    args = parser.parse_args()
    
    if args.demo:
        demo_workflow()
    else:
        quick_test()
