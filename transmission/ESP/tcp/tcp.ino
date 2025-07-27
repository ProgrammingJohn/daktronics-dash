#include <WiFi.h>
#include <ETH.h>

// Replace with your Wi-Fi credentials
#define ETH_ADDR        1           // PHY address
#define ETH_POWER_PIN   16         // Power pin (-1 if not used)
#define ETH_MDC_PIN     23          // MDC pin
#define ETH_MDIO_PIN    18          // MDIO pin
#define ETH_RST_PIN     16          // Reset pin
#define ETH_TYPE        ETH_PHY_LAN8720


const char* ssid = "FTIS-WiFi";
const char* password = "@176FTIS3847!!";

WiFiServer tcpServer(1234);  // TCP server on port 1234
WiFiClient client;

bool eth_connected = false;

// Ethernet event handler
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

  // Initialize Ethernet
  WiFi.onEvent(WiFiEvent);
  ETH.begin(ETH_TYPE, ETH_ADDR, ETH_MDC_PIN, ETH_MDIO_PIN, ETH_POWER_PIN, ETH_CLOCK_GPIO17_OUT);
  // Wait briefly for Ethernet to establish
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
    Serial.println("\nConnected to Wi-Fi!");
    Serial.print("Wi-Fi IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Wi-Fi MAC Address: ");
    Serial.println(WiFi.macAddress());
  } else {
    Serial.print("Ethernet MAC Address: ");
    Serial.println(ETH.macAddress());
  }

  // Start TCP server
  tcpServer.begin();
  Serial.println("TCP server started");
}

void loop() {
  // Check for a new client
  if (!client || !client.connected()) {
    client = tcpServer.available();
  }

  // Relay RTD serial data to the TCP client
  if (client && client.connected()) {
    while (Serial.available()) {
      client.write(Serial.read());
    }
  }
}
