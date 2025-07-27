#include <WiFi.h>
#include <ETH.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET     -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// OLED Positions
#define OLED_COLOR_INDICATOR_SIZE 5

#define ETH_ADDR        1
#define ETH_POWER_PIN   16
#define ETH_MDC_PIN     23
#define ETH_MDIO_PIN    18
#define ETH_RST_PIN     16
#define ETH_TYPE        ETH_PHY_LAN8720

// const char* ssid = "FTIS-WiFi";
// const char* password = "@176FTIS3847!!";
const char* ssid = "Roth Wi-Fi";
const char* password = "60Avenelplace";


WiFiServer tcpServer(1234);
WiFiClient client;

bool eth_connected = false;
String ipAddr = "";
String macAddr = "";

// Draw OLED info screen
void drawOLED(bool flash = false) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(2);
  display.setCursor(25, 0);
  display.println("DakDash");

  display.setTextSize(1);
  display.setCursor(0, 26);
  display.print("SSID: ");
  display.println(ssid);
  
  display.setCursor(0, 36);
  display.print("IP: ");
  display.println(ipAddr);

  display.setCursor(0, 46);
  display.print("MAC: ");
  display.println(macAddr);

  if (flash) {
    display.fillRect(0, 0, OLED_COLOR_INDICATOR_SIZE, OLED_COLOR_INDICATOR_SIZE, SSD1306_WHITE);
  }

  display.display();
}

void WiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_ETH_START:
      Serial.println("Ethernet started");
      ETH.setHostname("WT32-ETH01");
      break;
    case ARDUINO_EVENT_ETH_CONNECTED:
      Serial.println("Ethernet connected");
      break;
    case ARDUINO_EVENT_ETH_GOT_IP:
      Serial.print("Ethernet IP Address: ");
      ipAddr = ETH.localIP().toString();
      Serial.println(ipAddr);
      macAddr = ETH.macAddress();
      eth_connected = true;
      drawOLED();  // Update screen
      break;
    case ARDUINO_EVENT_ETH_DISCONNECTED:
    case ARDUINO_EVENT_ETH_STOP:
      Serial.println("Ethernet disconnected");
      eth_connected = false;
      break;
    default:
      break;
  }
}

void setup() {
  Wire.begin(4, 5);
  Serial.begin(19200);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
    for (;;);
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(2);
  display.setCursor(25, 0);
  display.println("DakDash");
  display.setTextSize(1);
  display.setCursor(10, 28);
  display.print("SSID: ");
  display.println(ssid);

  display.display();

  WiFi.onEvent(WiFiEvent);
  ETH.begin(ETH_TYPE, ETH_ADDR, ETH_MDC_PIN, ETH_MDIO_PIN, ETH_POWER_PIN, ETH_CLOCK_GPIO17_OUT);

  unsigned long start = millis();
  while (!eth_connected && millis() - start < 15000) {
    delay(100);
  }

  if (!eth_connected) {
    Serial.println("Falling back to Wi-Fi...");
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }
    ipAddr = WiFi.localIP().toString();
    Serial.print("WiFi IP Address: ");
    Serial.println(ipAddr);
    macAddr = WiFi.macAddress();
  }

  drawOLED();
  tcpServer.begin();
  Serial.println("TCP server started");
}

void loop() {
  if (!client || !client.connected()) {
    client = tcpServer.available();
  }
  bool flash = false;

  if (client && client.connected()) {
    while (Serial.available()) {
      client.write(Serial.read());
      flash = true;
    }
  }

  if (flash) { // flash if client is connected and serial message read
    drawOLED(true);
    delay(60);
    drawOLED(false);
  }
}
