---
title: ESP32 / M5Stack
parent: Backends
nav_order: 2
---

# ESP32 Backend — M5Stack Core S3 SE

The `esp32` target emits MicroPython that runs under `uasyncio`, Espressif's cooperative async scheduler. Each AppyScript event handler becomes a separate `asyncio.Task`, so sensors and motors can interleave without blocking.

---

## Supported Hardware

| Item | Detail |
|------|--------|
| Board | M5Stack Core S3 SE |
| MCU | ESP32-S3 (dual-core Xtensa LX7, 240 MHz) |
| RAM | 8 MB PSRAM |
| Flash | 8 MB |
| Display | 2-inch IPS LCD, 320×240 |
| Built-in IMU | BMI270 (6-axis) |
| USB | USB-C (flashing + serial REPL) |
| Firmware | MicroPython 1.22+ with M5Stack stubs |

---

## Hardware Setup

1. Install **M5Burner** (Windows/macOS/Linux) from [docs.m5stack.com](https://docs.m5stack.com).
2. Select **CoreS3 SE → MicroPython** and click **Burn**.
3. After flashing, open a serial terminal at **115 200 baud** to reach the REPL.
4. Upload `applaa_robot_esp32.py` to the board root using **mpremote** or **Thonny**:
   ```bash
   mpremote connect auto cp applaa_robot_esp32.py :/applaa_robot_esp32.py
   ```
5. Save your compiled AppyScript output as `main.py` on the board — it runs on every boot.

---

## applaa_robot_esp32 Library

`applaa_robot_esp32.py` wraps the M5Stack GPIO and peripherals behind a unified `Robot` interface.

| Method | Description |
|--------|-------------|
| `Robot()` | constructor — initialises LCD, IMU, speaker |
| `await robot.move(direction, speed, secs)` | drive motors; `direction` = `'forward'\|'backward'\|'left'\|'right'` |
| `await robot.stop()` | brake both motors |
| `robot.say(text)` | display text on LCD + optional TTS if speaker wired |
| `await robot.wait(secs)` | non-blocking delay |
| `robot.read_button(name)` | read `'A'`, `'B'`, or `'C'` button state |
| `robot.read_imu()` | returns `{ax, ay, az, gx, gy, gz}` dict |

---

## Sensor Pinout (Grove / GPIO)

| Grove Port | Default use in AppyScript |
|------------|---------------------------|
| Port A (G1/G2) | I2C — ultrasonic distance sensor |
| Port B (G8/G9) | ADC — light / soil moisture |
| Port C (G18/G17) | UART — GPS module |
| GPIO 5 | Digital out — servo PWM |
| GPIO 6 | Digital out — buzzer |

---

## Generated Code Example

**AppyScript source (`demo.appy`):**

```
when button A pressed:
    move forward for 2 seconds
    say "done!"

when distance < 10:
    stop
    say "obstacle!"
```

**Compiled output (`main.py` — esp32 target):**

```python
import uasyncio as asyncio
from applaa_robot_esp32 import Robot

robot = Robot()

async def handler_button_A():
    while True:
        if robot.read_button('A'):
            await robot.move('forward', speed=80, secs=2)
            robot.say('done!')
        await asyncio.sleep_ms(50)

async def handler_distance_lt_10():
    while True:
        sensor = robot.read_distance()
        if sensor < 10:
            await robot.stop()
            robot.say('obstacle!')
        await asyncio.sleep_ms(100)

async def main():
    asyncio.create_task(handler_button_A())
    asyncio.create_task(handler_distance_lt_10())
    # keep the event loop alive
    while True:
        await asyncio.sleep(1)

asyncio.run(main())
```

Key points:
- Every `when` block becomes one `asyncio.Task` polling at the right interval.
- `asyncio.sleep_ms` is used for sub-second polling; `asyncio.sleep` for longer waits.
- The outer `main()` coroutine holds the loop open indefinitely.

---

## Flashing the Compiled Output

```bash
# copy main.py to the board and soft-reset
mpremote connect auto cp main.py :/main.py + exec "import machine; machine.reset()"
```

Or open Thonny, paste the output into the editor, save as `main.py` directly to the board.
