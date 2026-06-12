"""
Applaa Robot Library — Raspberry Pi Pico W
Version: 1.0.0

Default wiring:
  Motor A (left):   GP0 (fwd), GP1 (bck) via PWM
  Motor B (right):  GP2 (fwd), GP3 (bck) via PWM
  Distance sensor:  Trig GP4, Echo GP5 (HC-SR04, 3.3V compatible)
  Light sensor:     GP26 (ADC0)
  Temperature:      GP27 (ADC1 — NTC thermistor) or internal sensor
  Touch:            GP28 (ADC2 — high when touched with 10kΩ pull-down)
  Speaker/Buzzer:   GP15 (PWM)
  NVM storage:      machine.RTC or picow_flash
"""

import machine, time, random
from machine import Pin, PWM, ADC

DEFAULT_CONFIG = {
    'motor_a_fwd': 0,  'motor_a_bck': 1,
    'motor_b_fwd': 2,  'motor_b_bck': 3,
    'distance_trig': 4, 'distance_echo': 5,
    'light_pin': 26,
    'temp_pin': 27,
    'touch_pin': 28,
    'speaker_pin': 15,
    'motor_freq': 1000,
}

class Motors:
    def __init__(self, cfg):
        freq = cfg['motor_freq']
        self._af = PWM(Pin(cfg['motor_a_fwd'])); self._af.freq(freq)
        self._ab = PWM(Pin(cfg['motor_a_bck'])); self._ab.freq(freq)
        self._bf = PWM(Pin(cfg['motor_b_fwd'])); self._bf.freq(freq)
        self._bb = PWM(Pin(cfg['motor_b_bck'])); self._bb.freq(freq)

    def _duty(self, pct):
        # Pico PWM: 0-65535
        return min(65535, max(0, int(pct * 655.35)))

    def _set(self, af, ab, bf, bb):
        self._af.duty_u16(self._duty(af)); self._ab.duty_u16(self._duty(ab))
        self._bf.duty_u16(self._duty(bf)); self._bb.duty_u16(self._duty(bb))

    def forward(self,  speed=50): self._set(speed,0,speed,0)
    def backward(self, speed=50): self._set(0,speed,0,speed)
    def left(self,     speed=50): self._set(0,speed,speed,0)
    def right(self,    speed=50): self._set(speed,0,0,speed)
    def stop(self):               self._set(0,0,0,0)

    def turn_left(self, degrees=90):
        ms = int(degrees * 1000/180)
        self.left(50); time.sleep_ms(ms); self.stop()

    def turn_right(self, degrees=90):
        ms = int(degrees * 1000/180)
        self.right(50); time.sleep_ms(ms); self.stop()

class Sensors:
    def __init__(self, cfg):
        self._trig = Pin(cfg['distance_trig'], Pin.OUT)
        self._echo = Pin(cfg['distance_echo'], Pin.IN)
        self._light = ADC(Pin(cfg['light_pin']))
        self._touch = ADC(Pin(cfg['touch_pin']))
        self._temp_pin = cfg['temp_pin']

    def distance(self):
        self._trig.value(0); time.sleep_us(2)
        self._trig.value(1); time.sleep_us(10)
        self._trig.value(0)
        start = time.ticks_us()
        while self._echo.value() == 0:
            if time.ticks_diff(time.ticks_us(), start) > 30000: return 999
        t0 = time.ticks_us()
        while self._echo.value() == 1:
            if time.ticks_diff(time.ticks_us(), t0) > 30000: return 999
        return round(time.ticks_diff(time.ticks_us(), t0) * 0.0171, 1)

    def ldr(self):
        """Light 0–100."""
        return round(self._light.read_u16() / 655.35)

    def temperature(self):
        """NTC thermistor on ADC. Calibrate for your thermistor."""
        raw = self._touch.read_u16()
        # Simple linear approximation — replace with Steinhart-Hart for accuracy
        return round(25 + (raw - 32768) / 1000, 1)

    def touch(self):
        return self._touch.read_u16() > 50000

    def shaken(self):   return False
    def tilted(self):   return False

class Voice:
    def __init__(self, cfg):
        self._pin = cfg['speaker_pin']

    def say(self, text):
        print(f"[SAY] {text}")
        self.beep(440, 100)

    def play(self, name):
        tones = {
            'success': [(523,100),(659,100),(784,200)],
            'fail':    [(392,200),(330,400)],
            'beep':    [(440,100)],
            'tada':    [(523,80),(523,80),(784,300)],
            'alert':   [(880,100),(0,50),(880,100)],
        }
        for freq, ms in tones.get(name, [(440,100)]):
            if freq: self.beep(freq, ms)
            else: time.sleep_ms(ms)

    def beep(self, freq=440, ms=100):
        try:
            p = PWM(Pin(self._pin)); p.freq(freq); p.duty_u16(32768)
            time.sleep_ms(ms); p.duty_u16(0); p.deinit()
        except Exception: pass

    def stop(self):
        try: PWM(Pin(self._pin)).deinit()
        except Exception: pass

class NVMStore:
    """JSON-backed storage in Pico flash filesystem."""
    _FILE = '/appyscript_memory.json'

    def __init__(self):
        self._d = {}
        try:
            import json
            with open(self._FILE) as f: self._d = json.load(f)
        except Exception: pass

    def _flush(self):
        try:
            import json
            with open(self._FILE,'w') as f: json.dump(self._d, f)
        except Exception: pass

    def save(self, k, v): self._d[k]=v; self._flush()
    def load(self, k, default=0): return self._d.get(k, default)

class Radio:
    def __init__(self):
        self._inbox = []
        # Pico W: use network.WLAN or BLE for real comms
    def send(self, msg): print(f"[SEND] {msg}")
    def received(self): return len(self._inbox) > 0
    def read(self): return self._inbox.pop(0) if self._inbox else None

class Robot:
    """Main Applaa Robot class for Pico W."""
    def __init__(self, config=None):
        cfg = {**DEFAULT_CONFIG, **(config or {})}
        self.move    = Motors(cfg)
        self.sensor  = Sensors(cfg)
        self.voice   = Voice(cfg)
        self.nvm     = NVMStore()
        self.brain   = self.nvm     # alias
        self.radio   = Radio()
        self.button_a = Pin(14, Pin.IN, Pin.PULL_UP)  # adjust to your wiring
        self.button_b = Pin(15, Pin.IN, Pin.PULL_UP)

    def stop_all(self):
        self.move.stop(); self.voice.stop()
        print("[STOP ALL]")

    def begin(self):
        print("Applaa Robot (Pico W) ready!")
