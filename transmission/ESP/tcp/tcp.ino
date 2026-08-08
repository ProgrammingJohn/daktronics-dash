#include <WiFi.h>
#include <ETH.h>

// Wi-Fi fallback is intentionally unconfigured; primary transport is Ethernet DHCP.
#define ETH_ADDR        1
#define ETH_POWER_PIN   16
#define ETH_MDC_PIN     23
#define ETH_MDIO_PIN    18
#define ETH_RST_PIN     16
#define ETH_TYPE        ETH_PHY_LAN8720

const char* ssid = "";
const char* password = "";

WiFiServer tcpServer(1234);
WiFiClient client;

bool eth_connected = false;

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
      Serial.println(ETH.localIP());
      eth_connected = true;
      break;
    case ARDUINO_EVENT_ETH_DISCONNECTED:
      Serial.println("Ethernet disconnected");
      eth_connected = false;
      break;
    case ARDUINO_EVENT_ETH_STOP:
      Serial.println("Ethernet stopped");
      eth_connected = false;
      break;
    default:
      Serial.print("Unhandled event: ");
      Serial.println(event);
      break;
  }
}

void setup() {
  Serial.begin(19200);

  WiFi.onEvent(WiFiEvent);
  ETH.begin(ETH_TYPE, ETH_ADDR, ETH_MDC_PIN, ETH_MDIO_PIN, ETH_POWER_PIN,
            ETH_CLOCK_GPIO17_OUT);
  unsigned long start = millis();
  while (!eth_connected && millis() - start < 15000) {
    delay(100);
  }

  if (!eth_connected && ssid[0] != '\0') {
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
    }
  }

  tcpServer.begin();
}

void loop() {
  if (!client || !client.connected()) {
    client = tcpServer.available();
  }

  if (client && client.connected()) {
    while (Serial.available()) {
      client.write(Serial.read());
    }
  }
}
