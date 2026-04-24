"""
CRAYXUS 掼蛋键盘桥接 (运行在树莓派)

作用:
  1. 打开 Pico W 的 USB CDC 数据串口 (/dev/ttyACM1), 把游戏命令发给键盘
  2. 监听 Pico W 的 HID 键盘输入 (/dev/input/by-id/usb-CRAYXUS_Guandan_Keyboard-*-event-kbd),
     把按键事件 (S2, HA, PLAY, PASS, COL_A 等) 转发给游戏
  3. WebSocket 服务器 ws://localhost:8765, 浏览器 indexrp.html 连接

依赖:
  pip install pyserial evdev websockets

运行:
  python3 keyboard_bridge.py
  (开机自启建议写 systemd)
"""
import asyncio
import glob
import json
import re
import serial
import sys

try:
    import evdev
    HAS_EVDEV = True
except ImportError:
    HAS_EVDEV = False

try:
    import websockets
except ImportError:
    print("需要: pip install websockets pyserial evdev")
    sys.exit(1)


# ============================================================
# 配置
# ============================================================
WS_PORT = 8765
KEYBOARD_ID_PATTERN = '*Guandan*'   # 匹配 Pico 的 USB 产品名


# ============================================================
# 状态
# ============================================================
clients = set()              # 所有 WebSocket 客户端
pico_serial = None           # Pico USB CDC


# ============================================================
# 找键盘和串口
# ============================================================
def find_pico_serial():
    """找 Pico W 的 CDC data 端口"""
    import serial.tools.list_ports
    for port in serial.tools.list_ports.comports():
        if 'CRAYXUS' in (port.product or '') or 'Pico' in (port.description or ''):
            # Pico 会开两个串口, data 通常是 ttyACM1
            return port.device
    # 回退: 找所有 ACM 设备, 通常第二个是 data
    acms = sorted(glob.glob('/dev/ttyACM*'))
    if len(acms) >= 2:
        return acms[1]
    elif len(acms) == 1:
        return acms[0]
    return None


def find_keyboard_device():
    """找 HID 键盘设备"""
    if not HAS_EVDEV:
        return None
    for path in evdev.list_devices():
        dev = evdev.InputDevice(path)
        if 'Guandan' in dev.name or 'CRAYXUS' in dev.name:
            return dev
    return None


# ============================================================
# 按键解析: USB HID 字符序列 -> 字符串事件
# ============================================================
class KeyBuffer:
    """HID 键盘逐字符输入, 按回车成句"""
    KEY_MAP = {
        # evdev KEY_* code -> 字符
        evdev.ecodes.KEY_A: 'A', evdev.ecodes.KEY_B: 'B', evdev.ecodes.KEY_C: 'C',
        evdev.ecodes.KEY_D: 'D', evdev.ecodes.KEY_E: 'E', evdev.ecodes.KEY_F: 'F',
        evdev.ecodes.KEY_G: 'G', evdev.ecodes.KEY_H: 'H', evdev.ecodes.KEY_I: 'I',
        evdev.ecodes.KEY_J: 'J', evdev.ecodes.KEY_K: 'K', evdev.ecodes.KEY_L: 'L',
        evdev.ecodes.KEY_M: 'M', evdev.ecodes.KEY_N: 'N', evdev.ecodes.KEY_O: 'O',
        evdev.ecodes.KEY_P: 'P', evdev.ecodes.KEY_Q: 'Q', evdev.ecodes.KEY_R: 'R',
        evdev.ecodes.KEY_S: 'S', evdev.ecodes.KEY_T: 'T', evdev.ecodes.KEY_U: 'U',
        evdev.ecodes.KEY_V: 'V', evdev.ecodes.KEY_W: 'W', evdev.ecodes.KEY_X: 'X',
        evdev.ecodes.KEY_Y: 'Y', evdev.ecodes.KEY_Z: 'Z',
        evdev.ecodes.KEY_0: '0', evdev.ecodes.KEY_1: '1', evdev.ecodes.KEY_2: '2',
        evdev.ecodes.KEY_3: '3', evdev.ecodes.KEY_4: '4', evdev.ecodes.KEY_5: '5',
        evdev.ecodes.KEY_6: '6', evdev.ecodes.KEY_7: '7', evdev.ecodes.KEY_8: '8',
        evdev.ecodes.KEY_9: '9',
        evdev.ecodes.KEY_MINUS: '-', evdev.ecodes.KEY_SPACE: ' ',
        evdev.ecodes.KEY_GRAVE: '_',
    }

    def __init__(self):
        self.buf = ''

    def feed(self, code):
        """返回一个完整 token 或 None"""
        if code == evdev.ecodes.KEY_ENTER:
            tok = self.buf
            self.buf = ''
            return tok
        ch = self.KEY_MAP.get(code)
        if ch:
            self.buf += ch
        return None


# ============================================================
# 发送到 Pico
# ============================================================
def send_pico(cmd):
    global pico_serial
    if pico_serial is None:
        return
    try:
        if not cmd.endswith('\n'):
            cmd += '\n'
        pico_serial.write(cmd.encode('utf-8'))
    except Exception as e:
        print(f"[PICO WRITE ERR] {e}")


# ============================================================
# WebSocket Server
# ============================================================
async def ws_handler(websocket):
    clients.add(websocket)
    print(f"[WS] 客户端连接, 当前 {len(clients)} 个")
    try:
        async for msg in websocket:
            try:
                data = json.loads(msg)
            except:
                continue
            # 浏览器 -> 键盘
            cmd = data.get('cmd')
            if cmd:
                arg = data.get('arg', '')
                send_pico(f"{cmd}:{arg}" if arg else cmd)
    except:
        pass
    finally:
        clients.discard(websocket)
        print(f"[WS] 客户端断开, 当前 {len(clients)} 个")


async def broadcast_key(token):
    """把按键事件广播给所有 ws 客户端"""
    if not clients:
        return
    payload = json.dumps({'type': 'key', 'token': token})
    await asyncio.gather(
        *[c.send(payload) for c in clients], return_exceptions=True
    )


# ============================================================
# HID 键盘监听
# ============================================================
async def hid_listen():
    if not HAS_EVDEV:
        print("[HID] evdev 未安装, 跳过 HID 监听")
        return
    while True:
        dev = find_keyboard_device()
        if dev is None:
            print("[HID] 没找到键盘设备, 3 秒后重试")
            await asyncio.sleep(3)
            continue
        print(f"[HID] 连接到 {dev.path}: {dev.name}")
        buf = KeyBuffer()
        try:
            async for event in dev.async_read_loop():
                if event.type == evdev.ecodes.EV_KEY and event.value == 1:
                    tok = buf.feed(event.code)
                    if tok:
                        print(f"[KEY] {tok}")
                        await broadcast_key(tok)
        except OSError as e:
            print(f"[HID] 设备断开: {e}")
            await asyncio.sleep(2)


# ============================================================
# 主程序
# ============================================================
async def main():
    global pico_serial

    # 打开 Pico 串口
    port = find_pico_serial()
    if port:
        try:
            pico_serial = serial.Serial(port, 115200, timeout=0)
            print(f"[PICO] 连接到 {port}")
        except Exception as e:
            print(f"[PICO] 打开 {port} 失败: {e}")
    else:
        print("[PICO] 没找到, 灯光控制不可用")

    # 启动 WebSocket Server
    print(f"[WS] 监听 ws://localhost:{WS_PORT}")
    server = await websockets.serve(ws_handler, 'localhost', WS_PORT)

    # 并发: HID 监听 + WebSocket
    await asyncio.gather(
        hid_listen(),
        server.wait_closed(),
    )


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n停止.")
