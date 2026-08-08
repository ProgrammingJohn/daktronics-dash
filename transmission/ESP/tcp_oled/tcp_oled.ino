#include <Arduino.h>
#include <Wire.h>
#include <esp_system.h>

#include "connection_server.h"
#include "display_controller.h"
#include "discovery_responder.h"
#include "network_manager.h"
#include "serial_pipeline.h"

dakdash::SerialFramer serial_framer;
dakdash::LatestFrameStore latest_frame;
dakdash::NetworkManager network_manager;
dakdash::ConnectionServer connection_server(1234);
dakdash::DisplayController display_controller;
dakdash::DiscoveryResponder discovery_responder(1234);

String session_id;
uint32_t uart_bytes = 0;

void setup() {
  Wire.begin(4, 5);
  Serial.begin(19200);
  display_controller.begin();
  session_id = String("boot-") + String(esp_random(), HEX);
  network_manager.begin(millis());
}

void loop() {
  dakdash::CompletedFrame completed{};
  while (Serial.available()) {
    const int value = Serial.read();
    if (value < 0) break;
    ++uart_bytes;
    if (serial_framer.push(static_cast<uint8_t>(value), completed)) {
      latest_frame.publish(completed, millis());
    }
  }

  const uint32_t now_ms = millis();
  network_manager.tick(now_ms);
  const bool address_changed = network_manager.take_address_changed();
  discovery_responder.tick(
      now_ms, network_manager.ready(), address_changed,
      network_manager.device_id().c_str(), session_id.c_str(),
      network_manager.ip_address().c_str());
  connection_server.set_serial_metrics(uart_bytes,
                                       serial_framer.rejected_frames());
  connection_server.tick(now_ms, network_manager.ready(), address_changed,
                         network_manager.device_id().c_str(),
                         session_id.c_str(), latest_frame);

  const dakdash::DisplayStatus status{
      network_manager.ip_address().c_str(),
      network_manager.device_id().c_str(),
      network_manager.state_text(),
      connection_server.state_text(),
      latest_frame.state_seq(),
      latest_frame.received_ms(),
  };
  display_controller.tick(now_ms, status);
}
