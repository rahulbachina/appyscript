/**
 * AppyRobot.h — Arduino C++ Runtime Library
 * Applaa / AppyScript v1.0.0
 *
 * Default wiring (all configurable via AppyRobot constructor):
 *   Motor A (left):   Pin 5 (ENA), Pin 6 (IN1), Pin 7 (IN2)  — L298N
 *   Motor B (right):  Pin 11 (ENB), Pin 12 (IN3), Pin 13 (IN4)
 *   Distance sensor:  Trig Pin 9, Echo Pin 10 (HC-SR04)
 *   Light sensor:     A0 (LDR with 10kΩ pull-down)
 *   Temperature:      A1 (NTC thermistor) or DHT11 on Pin 8
 *   Touch sensor:     A2 (capacitive pad)
 *   Speaker/Buzzer:   Pin 3 (PWM)
 *   EEPROM:           Built-in (AVR)
 *
 * Install: Copy AppyRobot.h to your Arduino libraries folder,
 *          or place next to your .ino file.
 */

#pragma once
#include <Arduino.h>
#include <EEPROM.h>
#include <vector>

// ── Pin configuration struct ──────────────────────────────────────────────────

struct AppyConfig {
    uint8_t motor_a_en  = 5;
    uint8_t motor_a_in1 = 6;
    uint8_t motor_a_in2 = 7;
    uint8_t motor_b_en  = 11;
    uint8_t motor_b_in3 = 12;
    uint8_t motor_b_in4 = 13;
    uint8_t dist_trig   = 9;
    uint8_t dist_echo   = 10;
    uint8_t light_pin   = A0;
    uint8_t temp_pin    = A1;
    uint8_t touch_pin   = A2;
    uint8_t speaker_pin = 3;
    uint8_t btn_a_pin   = 2;
    uint8_t btn_b_pin   = 4;
};

// ── EEPROM key-value store ────────────────────────────────────────────────────

class AppyEEPROM {
public:
    // Store a float at a named slot (8 slots, indices 0–7)
    void write(const char* key, float value) {
        int slot = _slot(key);
        if (slot < 0) slot = _nextSlot(key);
        if (slot < 0) return; // EEPROM full
        EEPROM.put(slot * 8, value);
    }

    float read(const char* key, float defaultVal = 0.0f) {
        int slot = _slot(key);
        if (slot < 0) return defaultVal;
        float val;
        EEPROM.get(slot * 8, val);
        return isnan(val) ? defaultVal : val;
    }

private:
    // Simple 8-slot directory stored at EEPROM address 400+
    static const int DIR_START = 400;
    static const int MAX_SLOTS = 8;

    int _slot(const char* key) {
        for (int i = 0; i < MAX_SLOTS; i++) {
            char stored[8]; EEPROM.get(DIR_START + i * 8, stored);
            if (strncmp(stored, key, 7) == 0) return i;
        }
        return -1;
    }

    int _nextSlot(const char* key) {
        for (int i = 0; i < MAX_SLOTS; i++) {
            char stored[8]; EEPROM.get(DIR_START + i * 8, stored);
            if (stored[0] == 0xFF || stored[0] == 0) {
                EEPROM.put(DIR_START + i * 8, key);
                return i;
            }
        }
        return -1; // no space
    }
};

// ── Main AppyRobot class ──────────────────────────────────────────────────────

class AppyRobot {
public:
    AppyConfig cfg;
    AppyEEPROM eeprom;

    AppyRobot() {}
    AppyRobot(AppyConfig c) : cfg(c) {}

    void begin() {
        // Motors
        pinMode(cfg.motor_a_en,  OUTPUT); pinMode(cfg.motor_a_in1, OUTPUT); pinMode(cfg.motor_a_in2, OUTPUT);
        pinMode(cfg.motor_b_en,  OUTPUT); pinMode(cfg.motor_b_in3, OUTPUT); pinMode(cfg.motor_b_in4, OUTPUT);
        // Sensors
        pinMode(cfg.dist_trig,   OUTPUT); pinMode(cfg.dist_echo,   INPUT);
        // Buttons
        pinMode(cfg.btn_a_pin,   INPUT_PULLUP);
        pinMode(cfg.btn_b_pin,   INPUT_PULLUP);
        // Speaker
        pinMode(cfg.speaker_pin, OUTPUT);
        stop();
        Serial.println(F("Applaa Robot ready!"));
    }

    // ── Movement ──────────────────────────────────────────────────────────────

    void move(const char* direction, int speed = 50) {
        int pwm = map(speed, 0, 100, 0, 255);
        if      (strcmp(direction, "forward")  == 0) _drive(pwm,  pwm);
        else if (strcmp(direction, "backward") == 0) _drive(-pwm, -pwm);
        else if (strcmp(direction, "left")     == 0) _drive(-pwm,  pwm);
        else if (strcmp(direction, "right")    == 0) _drive(pwm,  -pwm);
    }

    void stop() { _drive(0, 0); }

    void stop_all() {
        stop();
        noTone(cfg.speaker_pin);
        Serial.println(F("[STOP ALL]"));
    }

    void turn(const char* direction, int degrees) {
        int ms = map(degrees, 0, 360, 0, 2000); // ~2s for full rotation
        if (strcmp(direction, "left") == 0) { _drive(-128, 128); }
        else                                 { _drive(128, -128); }
        delay(ms);
        stop();
    }

    // ── Sensors ───────────────────────────────────────────────────────────────

    float distance() {
        digitalWrite(cfg.dist_trig, LOW);  delayMicroseconds(2);
        digitalWrite(cfg.dist_trig, HIGH); delayMicroseconds(10);
        digitalWrite(cfg.dist_trig, LOW);
        long duration = pulseIn(cfg.dist_echo, HIGH, 30000);
        return duration == 0 ? 999.0f : duration * 0.0171f;
    }

    int light() {
        return map(analogRead(cfg.light_pin), 0, 1023, 0, 100);
    }

    float temperature() {
        // NTC thermistor approximation (10kΩ, β=3950, 25°C reference)
        int raw = analogRead(cfg.temp_pin);
        float resistance = (1023.0f / raw - 1) * 10000.0f;
        float logR = log(resistance / 10000.0f);
        float temp = 1.0f / (0.001129f + 0.000234f * logR + 0.0000000876f * logR * logR * logR);
        return temp - 273.15f;
    }

    bool touch() {
        return analogRead(cfg.touch_pin) > 512;
    }

    float accelerationMagnitude() { return 0.0f; } // Needs IMU

    bool buttonA() { return digitalRead(cfg.btn_a_pin) == LOW; }
    bool buttonB() { return digitalRead(cfg.btn_b_pin) == LOW; }
    bool shaken()  { return false; }
    bool tilted()  { return false; }

    // ── Output ────────────────────────────────────────────────────────────────

    void showExpression(const char* expression) {
        Serial.print(F("[SHOW] ")); Serial.println(expression);
        // Add NeoPixel / LCD code here for your specific display
    }

    void showText(const String& text) {
        Serial.print(F("[DISPLAY] ")); Serial.println(text);
    }

    void showNumber(float n) {
        Serial.print(F("[DISPLAY] ")); Serial.println(n);
    }

    void playSound(const char* name) {
        struct { const char* name; int freq; int ms; } sounds[] = {
            {"success", 784, 300}, {"fail",  330, 500},
            {"beep",    440, 100}, {"alert", 880, 200},
            {"tada",    523, 300}, {nullptr,   0,   0},
        };
        for (int i = 0; sounds[i].name; i++) {
            if (strcmp(sounds[i].name, name) == 0) {
                tone(cfg.speaker_pin, sounds[i].freq, sounds[i].ms);
                delay(sounds[i].ms + 20);
                return;
            }
        }
        tone(cfg.speaker_pin, 440, 100);
    }

    // ── EEPROM wrappers ───────────────────────────────────────────────────────

    void eepromWrite(const char* key, float val) { eeprom.write(key, val); }
    float eepromRead(const char* key)            { return eeprom.read(key); }

    // ── Radio (stub — implement with NRF24L01 or HC-12) ──────────────────────

    void radioSend(const String& msg) {
        Serial.print(F("[SEND] ")); Serial.println(msg);
    }
    bool radioReceived() { return false; }

private:
    void _drive(int left, int right) {
        // Motor A
        if (left >= 0) { digitalWrite(cfg.motor_a_in1, HIGH); digitalWrite(cfg.motor_a_in2, LOW);  }
        else           { digitalWrite(cfg.motor_a_in1, LOW);  digitalWrite(cfg.motor_a_in2, HIGH); left = -left; }
        analogWrite(cfg.motor_a_en, constrain(left, 0, 255));
        // Motor B
        if (right >= 0) { digitalWrite(cfg.motor_b_in3, HIGH); digitalWrite(cfg.motor_b_in4, LOW);  }
        else            { digitalWrite(cfg.motor_b_in3, LOW);  digitalWrite(cfg.motor_b_in4, HIGH); right = -right; }
        analogWrite(cfg.motor_b_en, constrain(right, 0, 255));
    }
};
