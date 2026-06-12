"""
Applaa Robot Library — ESP32 / M5Stack Core S3 SE
Version: 1.0.0

Hardware defaults (all configurable via Robot config dict):
  Motor A (left):   PWM on GPIO 13 (forward) / GPIO 14 (backward)
  Motor B (right):  PWM on GPIO 25 (forward) / GPIO 26 (backward)
  Distance sensor:  Trigger GPIO 5, Echo GPIO 18
  Light sensor:     ADC on GPIO 36
  Temperature:      DS18B20 on GPIO 4  (falls back to internal ADC)
  Touch:            GPIO 15 (capacitive)
  Speaker:          GPIO 2 (PWM tone)
  NeoPixel / LED:   GPIO 27, 1 pixel

Usage:
  from applaa_robot import Robot
  robot = Robot()                     # default pin config
  robot = Robot({'motor_a_fwd': 13})  # custom pin
"""

import machine
import time
import random

try:
    from machine import Pin, PWM, ADC
    from neopixel import NeoPixel
    HAS_NEOPIXEL = True
except ImportError:
    HAS_NEOPIXEL = False

# ── Default pin configuration ─────────────────────────────────────────────────

DEFAULT_CONFIG = {
    'motor_a_fwd': 13,  'motor_a_bck': 14,
    'motor_b_fwd': 25,  'motor_b_bck': 26,
    'distance_trig': 5, 'distance_echo': 18,
    'light_pin': 36,
    'temp_pin': 4,
    'touch_pin': 15,
    'speaker_pin': 2,
    'led_pin': 27,
    'motor_freq': 1000,  # PWM frequency Hz
}

# Face expressions → NeoPixel RGB colours
EXPRESSION_COLOURS = {
    'happy':    (0, 255, 0),
    'sad':      (0, 0, 255),
    'thinking': (128, 0, 128),
    'excited':  (255, 165, 0),
    'angry':    (255, 0, 0),
    'alert':    (255, 255, 0),
    'sleep':    (0, 0, 20),
    'calm':     (0, 128, 128),
    'confused': (255, 20, 147),
    'dizzy':    (255, 255, 255),
}

# ── Motor controller ──────────────────────────────────────────────────────────

class Motors:
    def __init__(self, cfg):
        freq = cfg['motor_freq']
        self._a_fwd = PWM(Pin(cfg['motor_a_fwd']), freq=freq, duty=0)
        self._a_bck = PWM(Pin(cfg['motor_a_bck']), freq=freq, duty=0)
        self._b_fwd = PWM(Pin(cfg['motor_b_fwd']), freq=freq, duty=0)
        self._b_bck = PWM(Pin(cfg['motor_b_bck']), freq=freq, duty=0)

    def _duty(self, pct):
        # Convert 0-100% to 0-1023 (ESP32 PWM range)
        return min(1023, max(0, int(pct * 10.23)))

    def _set(self, a_fwd, a_bck, b_fwd, b_bck):
        self._a_fwd.duty(self._duty(a_fwd))
        self._a_bck.duty(self._duty(a_bck))
        self._b_fwd.duty(self._duty(b_fwd))
        self._b_bck.duty(self._duty(b_bck))

    def forward(self, speed=50):
        self._set(speed, 0, speed, 0)

    def backward(self, speed=50):
        self._set(0, speed, 0, speed)

    def left(self, speed=50):
        self._set(0, speed, speed, 0)

    def right(self, speed=50):
        self._set(speed, 0, 0, speed)

    def stop(self):
        self._set(0, 0, 0, 0)

    def turn_left(self, degrees=90):
        # Approximation: 90° ≈ 500ms at 50% speed
        ms = int(degrees * 1000 / 180)
        self.left(50)
        time.sleep_ms(ms)
        self.stop()

    def turn_right(self, degrees=90):
        ms = int(degrees * 1000 / 180)
        self.right(50)
        time.sleep_ms(ms)
        self.stop()

# ── Sensors ───────────────────────────────────────────────────────────────────

class Sensors:
    def __init__(self, cfg):
        self._trig = Pin(cfg['distance_trig'], Pin.OUT)
        self._echo = Pin(cfg['distance_echo'], Pin.IN)
        self._light = ADC(Pin(cfg['light_pin']))
        self._light.atten(ADC.ATTN_11DB)
        self._touch = Pin(cfg['touch_pin'], Pin.IN)
        self._temp_pin = cfg['temp_pin']
        self._last_shake = 0

    def distance(self):
        """Returns distance in cm using HC-SR04."""
        self._trig.value(0); time.sleep_us(2)
        self._trig.value(1); time.sleep_us(10)
        self._trig.value(0)
        start = time.ticks_us()
        while self._echo.value() == 0:
            if time.ticks_diff(time.ticks_us(), start) > 30000:
                return 999  # timeout = nothing detected
        pulse_start = time.ticks_us()
        while self._echo.value() == 1:
            if time.ticks_diff(time.ticks_us(), pulse_start) > 30000:
                return 999
        pulse_end = time.ticks_us()
        duration = time.ticks_diff(pulse_end, pulse_start)
        return round(duration * 0.0171, 1)  # cm

    def light(self):
        """Returns light level 0–100 (0=dark, 100=bright)."""
        raw = self._light.read()
        return round(raw / 40.95)  # 4095 → 100

    def temperature(self):
        """Returns temperature in °C. Tries DS18B20, falls back to estimate."""
        try:
            import ds18x20, onewire
            ow = onewire.OneWire(Pin(self._temp_pin))
            ds = ds18x20.DS18X20(ow)
            roms = ds.scan()
            if roms:
                ds.convert_temp()
                time.sleep_ms(750)
                return round(ds.read_temp(roms[0]), 1)
        except Exception:
            pass
        # Fallback: rough ADC estimate (not accurate, for demos only)
        adc = ADC(Pin(self._temp_pin))
        adc.atten(ADC.ATTN_11DB)
        return round(adc.read() * 0.0488 - 50, 1)

    def touch(self):
        """Returns True if capacitive touch pad is pressed."""
        return self._touch.value() == 0

    def shaken(self):
        """Simulated shake detection via acceleration threshold."""
        # Real implementation needs an IMU (MPU6050 etc.)
        return False

    def tilted(self, direction=None):
        """Simulated tilt. Override with IMU if available."""
        return False

    def acceleration_magnitude(self):
        """Returns total acceleration. Needs IMU library."""
        return 0

# ── Voice / output ────────────────────────────────────────────────────────────

class Voice:
    def __init__(self, cfg):
        self._pin = cfg['speaker_pin']

    def say(self, text):
        """Print to serial (USB) — add TTS module for real speech."""
        print(f"[SAY] {text}")
        self.beep(440, 100)

    def play(self, sound_name):
        """Play a named sound — maps to tones for now."""
        tones = {
            'success': [(523, 100), (659, 100), (784, 200)],
            'fail':    [(392, 200), (330, 400)],
            'beep':    [(440, 100)],
            'tada':    [(523, 80), (523, 80), (523, 80), (659, 300)],
            'alert':   [(880, 100), (0, 50), (880, 100)],
        }
        for freq, ms in tones.get(sound_name, [(440, 100)]):
            if freq > 0:
                self.beep(freq, ms)
            else:
                time.sleep_ms(ms)

    def beep(self, freq=440, ms=100):
        try:
            spk = PWM(Pin(self._pin), freq=freq, duty=512)
            time.sleep_ms(ms)
            spk.deinit()
        except Exception:
            pass

    def stop(self):
        try:
            PWM(Pin(self._pin)).deinit()
        except Exception:
            pass

# ── Display ───────────────────────────────────────────────────────────────────

class Display:
    def __init__(self, cfg):
        self._np = None
        if HAS_NEOPIXEL:
            try:
                self._np = NeoPixel(Pin(cfg['led_pin']), 1)
            except Exception:
                pass

    def expression(self, name):
        """Show emotion via NeoPixel colour + serial print."""
        print(f"[SHOW] {name}")
        colour = EXPRESSION_COLOURS.get(name, (128, 128, 128))
        if self._np:
            self._np[0] = colour
            self._np.write()

    def show(self, text):
        """Display text (serial + optional OLED)."""
        print(f"[DISPLAY] {text}")

    def number(self, n):
        print(f"[DISPLAY] {n}")

    def clear(self):
        if self._np:
            self._np[0] = (0, 0, 0)
            self._np.write()

# ── Wireless ──────────────────────────────────────────────────────────────────

class Radio:
    def __init__(self):
        self._inbox = []
        # ESP32 can use ESP-NOW or WiFi — stub for now
        # Replace with: import espnow / import network

    def send(self, message):
        print(f"[SEND] {message}")

    def received(self):
        return len(self._inbox) > 0

    def read(self):
        return self._inbox.pop(0) if self._inbox else None

# ── Persistent memory (flash) ─────────────────────────────────────────────────

class Brain:
    """Simple key-value store using a JSON file in flash."""
    _FILE = '/appyscript_memory.json'

    def __init__(self):
        self._data = {}
        self._load_all()

    def _load_all(self):
        try:
            import json
            with open(self._FILE) as f:
                self._data = json.load(f)
        except Exception:
            self._data = {}

    def _flush(self):
        try:
            import json
            with open(self._FILE, 'w') as f:
                json.dump(self._data, f)
        except Exception:
            pass

    def save(self, key, value):
        self._data[key] = value
        self._flush()

    def load(self, key, default=0):
        return self._data.get(key, default)

    # Legacy aliases
    def remember(self, key, value): self.save(key, value)

# ── Emergency stop ─────────────────────────────────────────────────────────────

def _stop_all_motors(motors, voice, display):
    motors.stop()
    voice.stop()
    display.clear()
    print("[STOP ALL]")

# ── Main Robot class ───────────────────────────────────────────────────────────

class Robot:
    """
    Main entry point for AppyScript-generated programs.

    Usage:
        robot = Robot()                       # default pins
        robot = Robot({'motor_a_fwd': 13})    # override specific pin

    Generated code calls:
        robot.move.forward(speed=50)
        robot.move.stop()
        robot.sensor.distance()
        robot.voice.say("Hello!")
        robot.display.expression("happy")
        robot.brain.save("score", score)
        robot.radio.send("hello")
        robot.button_a()
        robot.stop_all()
    """

    def __init__(self, config=None):
        cfg = {**DEFAULT_CONFIG, **(config or {})}
        self.move    = Motors(cfg)
        self.sensor  = Sensors(cfg)
        self.voice   = Voice(cfg)
        self.display = Display(cfg)
        self.radio   = Radio()
        self.brain   = Brain()
        self._cfg    = cfg
        self._btn_a  = Pin(0,  Pin.IN, Pin.PULL_UP)  # Boot button on most ESP32 boards
        self._btn_b  = Pin(35, Pin.IN, Pin.PULL_UP)  # Second button if available

    def button_a(self):
        return self._btn_a.value() == 0

    def button_b(self):
        return self._btn_b.value() == 0

    def stop_all(self):
        _stop_all_motors(self.move, self.voice, self.display)

    def begin(self):
        """Called once at startup."""
        print("Applaa Robot ready!")
        self.display.expression("calm")
