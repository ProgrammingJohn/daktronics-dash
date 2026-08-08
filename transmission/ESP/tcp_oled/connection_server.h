#pragma once

#include <Arduino.h>
#include <WiFi.h>

#include "connection_protocol.h"
#include "delivery_cursor.h"
#include "serial_pipeline.h"

namespace dakdash {

enum class ClientState {
  LISTENING,
  WAITING_HELLO,
  SENDING_HELLO,
  ACTIVE,
};

class ConnectionServer {
 public:
  explicit ConnectionServer(uint16_t port = 1234);
  void tick(uint32_t now_ms, bool network_ready, bool address_changed,
            const char* device_id, const char* session_id,
            const LatestFrameStore& latest_frame);
  void set_serial_metrics(uint32_t uart_bytes, uint32_t rejected_frames);
  ClientState state() const;
  const char* state_text() const;
  const HealthMetrics& metrics() const;

 private:
  void restart_listener();
  void accept_client(uint32_t now_ms);
  void read_hello(uint32_t now_ms);
  void service_active(uint32_t now_ms, const LatestFrameStore& latest_frame);
  bool finish_record(std::size_t body_length);
  bool flush_output();
  bool socket_writable();
  void abandon_client(bool write_failure = false);
  ProtocolFields fields(uint32_t now_ms, uint32_t state_seq,
                        uint32_t serial_age_ms);

  WiFiServer server_;
  WiFiClient client_;
  uint16_t port_;
  bool listening_{false};
  ClientState state_{ClientState::LISTENING};
  uint32_t accepted_ms_{0};
  uint32_t packet_seq_{0};
  uint32_t last_heartbeat_ms_{0};
  String device_id_{};
  String session_id_{};
  uint8_t input_[kMaxRecordBytes + 4]{};
  std::size_t input_length_{0};
  std::size_t expected_record_length_{0};
  uint8_t output_[kMaxRecordBytes + 5]{};
  std::size_t output_length_{0};
  std::size_t output_offset_{0};
  DeliveryCursor delivery_cursor_{};
  HealthMetrics metrics_{};
};

}  // namespace dakdash
