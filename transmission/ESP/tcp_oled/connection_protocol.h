#pragma once

#include <cstddef>
#include <cstdint>

#include "serial_pipeline.h"

namespace dakdash {

constexpr uint32_t kProtocolVersion = 1;
constexpr std::size_t kMaxRecordBytes = 4096;
constexpr std::size_t kMaxDatagramBytes = 1200;

struct ProtocolFields {
  const char* device_id;
  const char* session_id;
  uint32_t packet_seq;
  uint32_t state_seq;
  uint32_t uptime_ms;
  uint32_t serial_age_ms;
};

struct HealthMetrics {
  uint32_t uart_bytes;
  uint32_t rejected_frames;
  uint32_t overwritten_frames;
  uint32_t tcp_connects;
  uint32_t tcp_write_failures;
};

uint32_t crc32(const uint8_t* data, std::size_t length);
std::size_t base64_encode(const uint8_t* data, std::size_t length,
                          char* output, std::size_t capacity);
std::size_t encode_snapshot_json(const ProtocolFields& fields,
                                 const CompletedFrame& frame, char* output,
                                 std::size_t capacity);
std::size_t encode_hello_json(const ProtocolFields& fields, char* output,
                              std::size_t capacity);
std::size_t encode_heartbeat_json(const ProtocolFields& fields,
                                  const HealthMetrics& metrics, char* output,
                                  std::size_t capacity);
bool decode_client_hello(const char* json, std::size_t length,
                         char* expected_device_id, std::size_t capacity);
bool decode_discover_json(const char* json, std::size_t length,
                          const char* local_device_id, char* nonce,
                          std::size_t nonce_capacity);
std::size_t encode_discover_response_json(
    const ProtocolFields& fields, const char* nonce, const char* ip_address,
    uint16_t port, char* output, std::size_t capacity);

}  // namespace dakdash
