#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266httpUpdate.h>
#include <PubSubClient.h>
#include <U8g2lib.h>
#include <Wire.h>
#include "secrets.h"

// IdeaSpark built-in OLED: SDA=GPIO12(D6), SCL=GPIO14(D5)
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE, /* clock=*/ 14, /* data=*/ 12);

char deviceId[24] = "thermostat-unset"; // overwritten by deriveDeviceId() once WiFi is up
const char* DEVICE_ID = deviceId;
const char* FIRMWARE_VERSION = "0.1.4"; // keep to 0.1.NN — OLED layout in drawScreen() assumes <= 6 chars

String desiredFirmware = "";
bool otaFailed = false; // set on first failed OTA attempt; stays set until power-cycle
void checkAndApplyUpdate(); // defined later, in Step 4 (stubbed for now)

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// --- Simulation config ---
const float TEMP_MIN = 65.0;
const float TEMP_MAX = 75.0;
const float TEMP_START = 70.0;
const float TEMP_STEP = 1.0;
const unsigned long STEP_INTERVAL_MS = 60000; // 60 seconds

float simTemp = TEMP_START;
int direction = 1;
unsigned long lastStepTime = 0;

const char* MODE_LABEL = "SIM";

const unsigned long WIFI_TIMEOUT_MS = 20000; // give up after 20s
const unsigned long MQTT_RECONNECT_INTERVAL_MS = 5000;
unsigned long lastMqttAttempt = 0;

void drawStatusScreen(const char* line1, const char* line2) {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_7x13_tf);
  u8g2.drawStr(0, 20, line1);
  u8g2.drawStr(0, 40, line2);
  u8g2.sendBuffer();
}

void drawScreen() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_7x13_tf);
  u8g2.drawStr(0, 12, "Mode:");
  u8g2.drawStr(50, 12, MODE_LABEL);
  u8g2.drawStr(75, 12, FIRMWARE_VERSION);

  char statusLine[24];
  const char* wifiState = (WiFi.status() == WL_CONNECTED) ? "OK" : "X";
  const char* mqttState = mqttClient.connected() ? "OK" : "X";
  snprintf(statusLine, sizeof(statusLine), "WiFi:%s MQTT:%s", wifiState, mqttState);
  u8g2.drawStr(0, 62, statusLine);

  u8g2.setFont(u8g2_font_logisoso24_tf);
  char tempStr[8];
  snprintf(tempStr, sizeof(tempStr), "%.0fF", simTemp);
  u8g2.drawStr(20, 45, tempStr);

  u8g2.sendBuffer();
}

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  drawStatusScreen("Connecting WiFi...", WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected. IP: ");
    Serial.println(WiFi.localIP());
    drawStatusScreen("WiFi connected", WiFi.localIP().toString().c_str());
    delay(1500);
  } else {
    Serial.println("WiFi connect FAILED (timeout). Continuing without WiFi.");
    drawStatusScreen("WiFi FAILED", "continuing offline");
    delay(1500);
  }
}

void deriveDeviceId() {
  String mac = WiFi.macAddress(); // "AA:BB:CC:DD:EE:FF"
  mac.replace(":", "");
  mac.toLowerCase();
  snprintf(deviceId, sizeof(deviceId), "thermostat-%s", mac.c_str());
  Serial.print("Device ID: ");
  Serial.println(deviceId); // operator reads this to register the device
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message;
  message.reserve(length);
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  desiredFirmware = message;
  Serial.print("Desired firmware: ");
  Serial.println(desiredFirmware);
  checkAndApplyUpdate();
}

void checkAndApplyUpdate() {
  if (otaFailed) return; // already failed this boot; skip until power-cycle

  if (desiredFirmware.length() > 0 && desiredFirmware != FIRMWARE_VERSION) {
    Serial.print("Update needed: would attempt OTA from ");
    Serial.print(FIRMWARE_VERSION);
    Serial.print(" to ");
    Serial.println(desiredFirmware);

    drawStatusScreen("Update fimrware :", desiredFirmware.c_str());

    char url[128];
    snprintf(url, sizeof(url), "http://%s:%d/firmware/%s/download", API_HOST, API_PORT, desiredFirmware.c_str());


    WiFiClient client;
    t_httpUpdate_return ret = ESPhttpUpdate.update(client, url);

    switch(ret){
        case HTTP_UPDATE_FAILED:
            Serial.printf("OTA failed (%d): %s\n", ESPhttpUpdate.getLastError(), ESPhttpUpdate.getLastErrorString().c_str());
            drawStatusScreen("Update FAILED", ESPhttpUpdate.getLastErrorString().c_str());
            otaFailed = true;
            break;
        case HTTP_UPDATE_NO_UPDATES:
        Serial.println("OTA: no update needed.");
        break;
      case HTTP_UPDATE_OK:
        // device reboots automatically; this line won't be reached
        break;
    }
  }
}

void connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;

  Serial.print("Connecting to MQTT broker: ");
  Serial.print(MQTT_BROKER_HOST);
  Serial.print(":");
  Serial.println(MQTT_BROKER_PORT);

  if (mqttClient.connect(DEVICE_ID)) {
    Serial.println("MQTT connected.");
    char desiredTopic[64];
    snprintf(desiredTopic, sizeof(desiredTopic), "devices/%s/twin/desired/firmware", DEVICE_ID);
    mqttClient.subscribe(desiredTopic);
  } else {
    Serial.print("MQTT connect failed, rc=");
    Serial.println(mqttClient.state());
  }
}

void publishTelemetry(unsigned long uptimeMs) {
  if (!mqttClient.connected()) return;

  char payload[192];
  snprintf(payload, sizeof(payload),
           "{\"deviceId\":\"%s\",\"temperature\":%.1f,\"uptime\":%lu,\"firmware\":\"%s\",\"rssi\":%d}",
           DEVICE_ID, simTemp, uptimeMs, FIRMWARE_VERSION, WiFi.RSSI());

  char topic[48];
  snprintf(topic, sizeof(topic), "devices/%s/telemetry", DEVICE_ID);

  mqttClient.publish(topic, payload);
  Serial.print("Published: ");
  Serial.println(payload);
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

  connectWiFi();

  deriveDeviceId();

  mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  mqttClient.setCallback(onMqttMessage);
  connectMQTT();

  drawScreen();
  lastStepTime = millis();
}

void loop() {
  unsigned long now = millis();

  // If WiFi drops, try to reconnect (non-blocking check, ESP8266 core handles some of this automatically,
  // but we log status changes)
  static bool wasConnected = (WiFi.status() == WL_CONNECTED);
  bool isConnected = (WiFi.status() == WL_CONNECTED);
  if (isConnected != wasConnected) {
    Serial.println(isConnected ? "WiFi reconnected." : "WiFi lost connection.");
    wasConnected = isConnected;
    drawScreen();
  }

  if (isConnected) {
    if (mqttClient.connected()) {
      mqttClient.loop();
    } else if (now - lastMqttAttempt >= MQTT_RECONNECT_INTERVAL_MS) {
      lastMqttAttempt = now;
      connectMQTT();
      drawScreen();
    }
  }

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

    publishTelemetry(now);
    drawScreen();
  }
}
