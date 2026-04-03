#!/usr/bin/env python3
"""
Generate voice lines for Guandan AI All-in-One Machine
======================================================
Uses edge-tts (Microsoft Neural TTS) to generate high-quality Chinese voice lines.

Install: pip install edge-tts
Run:     python generate_voice.py

Output:  audio/voice/*.mp3
"""
import asyncio
import os
import json

try:
    import edge_tts
except ImportError:
    print("Installing edge-tts...")
    os.system("pip install edge-tts")
    import edge_tts

# ── Voice config ──
# Female voices: zh-CN-XiaoxiaoNeural (sweet), zh-CN-XiaoyiNeural (lively)
# Male voices: zh-CN-YunxiNeural (young male), zh-CN-YunjianNeural (narrator)
VOICE = "zh-CN-XiaoxiaoNeural"  # 小姐姐风格，亲和力强
RATE = "+5%"   # slightly faster
VOLUME = "+0%"

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio", "voice")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── All voice lines ──
# Format: (filename, text, [optional_rate_override])

VOICE_LINES = {
    # ═══════════════════════════════════════
    # 新手引导 / Welcome
    # ═══════════════════════════════════════
    "welcome_1": "你好！我是蛋蛋，你的AI掼蛋助手。欢迎来到掼蛋的世界！",
    "welcome_2": "我会陪你一起学习掼蛋，从新手到高手，一步一步来。",
    "welcome_3": "准备好了吗？让我们开始吧！",

    # 新手引导步骤
    "guide_keyboard": "这是你的专属键盘，每一列代表一个点数，从左到右是2、A、K、Q、J、10、9、8、7、6、5、4、3。",
    "guide_colors": "键盘上的灯光颜色代表花色：金色是方块，蓝色是黑桃，红色是红心，绿色是梅花。",
    "guide_select": "按下一个亮着的键就能选中那张牌，再按一次取消选中。选中的牌会变成白色。",
    "guide_play": "选好牌之后，按出牌键就能打出去。如果不想出牌，按过牌键跳过。",
    "guide_sort": "你可以整理手牌。选中几张牌，然后按空白位置的键，牌就会移到那里。双击模式键可以恢复默认排列。",
    "guide_ai_coach": "遇到不知道怎么出的牌，按模式键呼叫AI教练，它会告诉你最佳出牌方案。",
    "guide_done": "教程完成！现在你已经掌握了基本操作。开始你的掼蛋之旅吧！",
    "guide_skip": "你可以随时跳过教程。",

    # ═══════════════════════════════════════
    # 开局 / Game Start
    # ═══════════════════════════════════════
    "game_start_1": "新的一局开始了，祝你好运！",
    "game_start_2": "开局了！让我们看看这手牌怎么样。",
    "game_start_3": "新的一局，新的机会。加油！",

    # 发牌
    "dealing": "正在发牌。",
    "dealing_done": "发牌完成，看看你的手牌吧。",

    # 手牌评价
    "hand_great": "哇，这手牌不错！有好几个大牌。",
    "hand_good": "手牌还可以，合理安排应该能赢。",
    "hand_ok": "手牌一般，需要配合队友了。",
    "hand_bad": "这手牌有点难打，要稳住，等队友帮忙。",
    "hand_bomb": "手里有炸弹！关键时刻再用。",
    "hand_rocket": "王炸在手！这可是最大的底牌。",

    # ═══════════════════════════════════════
    # 出牌提醒 / Turn
    # ═══════════════════════════════════════
    "your_turn_1": "轮到你出牌了。",
    "your_turn_2": "该你了！",
    "your_turn_3": "你的回合。",
    "your_turn_free": "自由出牌，你想出什么都行。",
    "your_turn_follow": "需要跟牌，出更大的牌才行。",
    "hurry_up": "时间快到了，赶紧出牌吧。",

    # ═══════════════════════════════════════
    # 出牌评价 / Play Feedback
    # ═══════════════════════════════════════
    "play_single": "出了一张单牌。",
    "play_pair": "出了一对。",
    "play_triple": "出了三条。",
    "play_straight": "出了一手顺子！",
    "play_double_straight": "连对！打得漂亮。",
    "play_steel_plate": "钢板！这牌型威力不小。",
    "play_full_house": "三带二，很实用的牌型。",
    "play_bomb": "炸弹！威力巨大！",
    "play_rocket": "王炸！谁都挡不住！",
    "play_flush": "同花顺！最强炸弹！",

    "play_nice_1": "打得好！",
    "play_nice_2": "漂亮！",
    "play_nice_3": "好牌！",
    "play_smart": "这手牌出得很聪明。",
    "play_aggressive": "进攻很果断！",
    "play_steady": "稳扎稳打，不错。",

    # 过牌
    "pass_1": "过。",
    "pass_2": "选择观望。",
    "pass_3": "先不出，看看情况。",
    "pass_teammate": "队友过了。",
    "pass_opponent": "对手选择不出。",

    # ═══════════════════════════════════════
    # 特殊事件 / Events
    # ═══════════════════════════════════════
    "round_win": "漂亮！你赢得了这一轮的牌权。",
    "round_lose": "这轮牌权被对方拿走了。",

    "teammate_finish": "队友走完了！干得好，继续配合。",
    "opponent_finish": "注意，对手走完了一个人。",

    "bomb_played_by_me": "炸弹出击！",
    "bomb_played_by_opponent": "对手出了炸弹！小心应对。",
    "bomb_played_by_teammate": "队友炸了！配合得好。",

    # ═══════════════════════════════════════
    # 胜负 / Game End
    # ═══════════════════════════════════════
    "win_1": "恭喜你赢了！表现非常出色。",
    "win_2": "胜利！你的掼蛋水平又提升了。",
    "win_3": "赢了！继续保持这种状态。",
    "win_double": "双上！完美的团队配合！",

    "lose_1": "这局输了，没关系，下一局继续加油。",
    "lose_2": "虽然输了，但从失败中也能学到东西。",
    "lose_3": "别灰心，掼蛋就是这样，起起落落。",
    "lose_double": "双下了。别急，调整一下策略。",

    # ═══════════════════════════════════════
    # AI教练 / Coach
    # ═══════════════════════════════════════
    "coach_hint": "让我来帮你分析一下。",
    "coach_recommend": "AI教练建议你这样出牌。",
    "coach_thinking": "让我想想，这手牌可以这样打。",

    # ═══════════════════════════════════════
    # 教学 / Teaching
    # ═══════════════════════════════════════
    "lesson_start": "欢迎来到蛋力学院，让我们开始今天的课程。",
    "lesson_complete": "恭喜你完成了这节课！",
    "lesson_perfect": "满分通过！你真是天才！",
    "quiz_correct": "回答正确！",
    "quiz_wrong": "答错了，没关系，看看解析学习一下。",
    "quiz_explain": "让我来解释一下这道题。",

    # 段位测评
    "rank_start": "欢迎参加段位测评。一共20道题，认真答哦。",
    "rank_done": "测评结束！让我看看你的成绩。",
    "rank_up": "段位提升了！继续加油！",
    "rank_bronze": "目前是青铜段位，基础还需要加强。去蛋力学院多练练。",
    "rank_silver": "白银段位，已经入门了！继续学习高级策略。",
    "rank_gold": "黄金段位，不错！你已经是有经验的玩家了。",
    "rank_platinum": "铂金段位！高手就是不一样。",
    "rank_diamond": "钻石段位！你的掼蛋水平已经非常厉害了。",
    "rank_master": "掼蛋大师！你已经达到了最高水平，太强了！",

    # ═══════════════════════════════════════
    # 进贡 / Tribute
    # ═══════════════════════════════════════
    "tribute_start": "进贡环节开始了。",
    "tribute_give": "需要进贡，把最大的牌交出去。",
    "tribute_receive": "收到了进贡的牌，不错。",
    "tribute_resist": "抗贡！有对大王就不用交。",
    "tribute_done": "进贡结束，正式开始打牌。",

    # ═══════════════════════════════════════
    # 闲聊 / Idle
    # ═══════════════════════════════════════
    "idle_1": "在想什么呢？需要帮忙吗？",
    "idle_2": "要不要来一局掼蛋？",
    "idle_3": "可以去蛋力学院充充电哦。",
}


async def generate_one(filename, text, voice=VOICE, rate=RATE):
    """Generate a single voice line."""
    outpath = os.path.join(OUTPUT_DIR, f"{filename}.mp3")
    if os.path.exists(outpath):
        print(f"  [skip] {filename}.mp3 (exists)")
        return

    communicate = edge_tts.Communicate(text, voice, rate=rate, volume=VOLUME)
    await communicate.save(outpath)
    print(f"  [done] {filename}.mp3")


async def main():
    print(f"Voice: {VOICE}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Total lines: {len(VOICE_LINES)}")
    print()

    for filename, text in VOICE_LINES.items():
        try:
            await generate_one(filename, text)
        except Exception as e:
            print(f"  [FAIL] {filename}: {e}")

    print()
    print(f"Done! Generated {len(VOICE_LINES)} voice lines.")
    print()

    # Generate manifest for JS
    manifest = {k: f"audio/voice/{k}.mp3" for k in VOICE_LINES.keys()}
    manifest_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                 "audio", "voice_manifest.json")
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"Manifest: {manifest_path}")


if __name__ == '__main__':
    asyncio.run(main())
