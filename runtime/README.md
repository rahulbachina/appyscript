# AppyScript Runtime Libraries

These libraries make AppyScript-generated code run on real hardware.
Copy the relevant file to your robot before flashing your `.appy` program.

---

## ESP32 / M5Stack — `esp32/applaa_robot.py`

**Upload with:**
```bash
mpremote cp runtime/esp32/applaa_robot.py :applaa_robot.py
```
Or use Thonny: Files → Upload to device.

**Default wiring (L298N motor driver):**
```
Motor A forward  → GPIO 13
Motor A backward → GPIO 14
Motor B forward  → GPIO 25
Motor B backward → GPIO 26
HC-SR04 Trig     → GPIO 5
HC-SR04 Echo     → GPIO 18
LDR (light)      → GPIO 36
Speaker/buzzer   → GPIO 2
Boot button      → GPIO 0  (Button A)
```

**Custom pin config:**
```python
from applaa_robot import Robot
robot = Robot({
    'motor_a_fwd': 13,
    'motor_b_fwd': 25,
    'distance_trig': 5,
    'distance_echo': 18,
})
```

---

## Raspberry Pi Pico W — `pico/applaa_robot_pico.py`

**Upload with:**
```bash
mpremote cp runtime/pico/applaa_robot_pico.py :applaa_robot_pico.py
```

**Default wiring:**
```
Motor A forward  → GP0    Motor A backward → GP1
Motor B forward  → GP2    Motor B backward → GP3
HC-SR04 Trig     → GP4    HC-SR04 Echo     → GP5
LDR (light)      → GP26   Speaker          → GP15
Button A         → GP14   Button B         → GP13
```

---

## Arduino — `arduino/AppyRobot.h`

**Install:**
- Copy `AppyRobot.h` next to your generated `.ino` file, OR
- Copy to `~/Arduino/libraries/AppyRobot/AppyRobot.h`

**Default wiring (L298N motor driver):**
```
Motor A ENA → Pin 5     IN1 → Pin 6    IN2 → Pin 7
Motor B ENB → Pin 11    IN3 → Pin 12   IN4 → Pin 13
HC-SR04 Trig → Pin 9   Echo → Pin 10
LDR (light)  → A0      Speaker → Pin 3
Button A     → Pin 2   Button B → Pin 4
```

**Custom pin config:**
```cpp
#include "AppyRobot.h"
AppyConfig cfg;
cfg.motor_a_en = 5;
cfg.dist_trig  = 9;
AppyRobot robot(cfg);
```

---

## Wiring guides

See `docs/hardware/` for circuit diagrams for each target.

## Sensor calibration

The temperature and light sensor values are approximate.
Calibrate for your specific sensors by:
1. Reading the raw value at a known condition
2. Adjusting the formula in the library

For precise temperature: replace the NTC approximation with a DS18B20 (digital, pre-calibrated).
