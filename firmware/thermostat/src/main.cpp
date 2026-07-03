#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>

// IdeaSpark built-in OLED: SDA=GPIO12(D6), SCL=GPIO14(D5)
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE, /* clock=*/ 14, /* data=*/ 12);

// --- Simulation config ---
const float TEMP_MIN = 65.0;
const float TEMP_MAX = 75.0;
const float TEMP_START = 70.0;
const float TEMP_STEP = 1.0;
const unsigned long STEP_INTERVAL_MS = 60000; // 60 seconds

float simTemp = TEMP_START;
int direction = 1; // 1 = rising, -1 = falling
unsigned long lastStepTime = 0;

const char* MODE_LABEL = "SIMULATION";

void drawScreen() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_7x13_tf);
  u8g2.drawStr(0, 12, "Mode:");
  u8g2.drawStr(50, 12, MODE_LABEL);

  u8g2.setFont(u8g2_font_logisoso24_tf);
  char tempStr[8];
  snprintf(tempStr, sizeof(tempStr), "%.0fF", simTemp);
  u8g2.drawStr(20, 50, tempStr);

  u8g2.sendBuffer();
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println();
  Serial.println("=== BOOT ===");
  Serial.println("Thermostat firmware boot OK (SIMULATION MODE)");
  Serial.print("Starting temp: ");
  Serial.println(simTemp);

  u8g2.begin();
  drawScreen();

  lastStepTime = millis();
}

void loop() {
  unsigned long now = millis();

  if (now - lastStepTime >= STEP_INTERVAL_MS) {
    lastStepTime = now;

    simTemp += direction * TEMP_STEP;

    if (simTemp >= TEMP_MAX) {
      simTemp = TEMP_MAX;
      direction = -1;
    } else if (simTemp <= TEMP_MIN) {
      simTemp = TEMP_MIN;
      direction = 1;
    }

    Serial.print("Simulated temp: ");
    Serial.print(simTemp);
    Serial.print(" F  (uptime ms: ");
    Serial.print(now);
    Serial.println(")");

    drawScreen();
  }
}
