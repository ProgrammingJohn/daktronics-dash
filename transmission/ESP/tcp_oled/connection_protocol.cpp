#include "connection_protocol.h"

#ifndef ARDUINOJSON_POOL_CAPACITY
#define ARDUINOJSON_POOL_CAPACITY 64
#endif
#include <ArduinoJson.h>

#include <algorithm>
#include <cstddef>
#include <cstring>

namespace dakdash {

namespace {

constexpr char kBase64Alphabet[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

template <std::size_t Capacity>
class FixedAllocator : public ArduinoJson::Allocator {
 public:
  void* allocate(std::size_t size) override {
    const std::size_t aligned = align(offset_);
    const std::size_t needed = sizeof(Block) + size;
    if (aligned > Capacity || needed > Capacity - aligned) {
      return nullptr;
    }
    auto* block = reinterpret_cast<Block*>(storage_ + aligned);
    block->size = size;
    offset_ = aligned + needed;
    return block + 1;
  }

  void deallocate(void*) override {}

  void* reallocate(void* pointer, std::size_t new_size) override {
    if (pointer == nullptr) {
      return allocate(new_size);
    }
    auto* old_block = static_cast<Block*>(pointer) - 1;
    void* replacement = allocate(new_size);
    if (replacement != nullptr) {
      std::memcpy(replacement, pointer, std::min(old_block->size, new_size));
    }
    return replacement;
  }

 private:
  struct alignas(std::max_align_t) Block {
    std::size_t size;
  };

  static std::size_t align(std::size_t value) {
    const std::size_t alignment = alignof(std::max_align_t);
    return (value + alignment - 1) & ~(alignment - 1);
  }

  alignas(std::max_align_t) uint8_t storage_[Capacity]{};
  std::size_t offset_{0};
};

void add_common_fields(JsonDocument& document, const char* message_type,
                       const ProtocolFields& fields) {
  document["protocol_version"] = kProtocolVersion;
  document["message_type"] = message_type;
  document["device_id"] = fields.device_id;
  document["session_id"] = fields.session_id;
  document["packet_seq"] = fields.packet_seq;
  document["state_seq"] = fields.state_seq;
  document["uptime_ms"] = fields.uptime_ms;
  document["serial_age_ms"] = fields.serial_age_ms;
}

std::size_t serialize_bounded(JsonDocument& document, char* output,
                              std::size_t capacity) {
  if (output == nullptr || capacity == 0) {
    return 0;
  }
  if (document.overflowed()) {
    return 0;
  }
  const std::size_t required = measureJson(document);
  if (required > kMaxRecordBytes || required + 1 > capacity) {
    return 0;
  }
  const std::size_t written = serializeJson(document, output, capacity);
  return written == required ? written : 0;
}

bool fields_valid(const ProtocolFields& fields) {
  return fields.device_id != nullptr && fields.session_id != nullptr;
}

}  // namespace

uint32_t crc32(const uint8_t* data, std::size_t length) {
  uint32_t crc = 0xffffffffU;
  for (std::size_t index = 0; index < length; ++index) {
    crc ^= data[index];
    for (uint8_t bit = 0; bit < 8; ++bit) {
      const uint32_t mask = 0U - (crc & 1U);
      crc = (crc >> 1U) ^ (0xedb88320U & mask);
    }
  }
  return crc ^ 0xffffffffU;
}

std::size_t base64_encode(const uint8_t* data, std::size_t length,
                          char* output, std::size_t capacity) {
  const std::size_t encoded_length = 4 * ((length + 2) / 3);
  if (output == nullptr || capacity <= encoded_length ||
      (data == nullptr && length != 0)) {
    return 0;
  }

  std::size_t input = 0;
  std::size_t result = 0;
  while (input < length) {
    const uint32_t first = data[input++];
    const bool has_second = input < length;
    const uint32_t second = has_second ? data[input++] : 0;
    const bool has_third = input < length;
    const uint32_t third = has_third ? data[input++] : 0;
    const uint32_t triple = (first << 16U) | (second << 8U) | third;
    output[result++] = kBase64Alphabet[(triple >> 18U) & 0x3fU];
    output[result++] = kBase64Alphabet[(triple >> 12U) & 0x3fU];
    output[result++] = has_second
                           ? kBase64Alphabet[(triple >> 6U) & 0x3fU]
                           : '=';
    output[result++] = has_third ? kBase64Alphabet[triple & 0x3fU] : '=';
  }
  output[result] = '\0';
  return result;
}

std::size_t encode_snapshot_json(const ProtocolFields& fields,
                                 const CompletedFrame& frame, char* output,
                                 std::size_t capacity) {
  if (!fields_valid(fields) || frame.length > kMaxPayloadBytes) {
    return 0;
  }
  char payload[4 * ((kMaxPayloadBytes + 2) / 3) + 1]{};
  if (base64_encode(frame.bytes.data(), frame.length, payload,
                    sizeof(payload)) == 0 && frame.length != 0) {
    return 0;
  }

  FixedAllocator<kMaxRecordBytes> allocator;
  JsonDocument document(&allocator);
  add_common_fields(document, "SNAPSHOT", fields);
  document["payload"] = payload;
  document["payload_crc32"] = crc32(frame.bytes.data(), frame.length);
  document["details"].to<JsonObject>();
  return serialize_bounded(document, output, capacity);
}

std::size_t encode_heartbeat_json(const ProtocolFields& fields,
                                  const HealthMetrics& metrics, char* output,
                                  std::size_t capacity) {
  if (!fields_valid(fields)) {
    return 0;
  }
  FixedAllocator<kMaxRecordBytes> allocator;
  JsonDocument document(&allocator);
  add_common_fields(document, "HEARTBEAT", fields);
  document["payload"] = "";
  document["payload_crc32"] = 0;
  JsonObject details = document["details"].to<JsonObject>();
  details["uart_bytes"] = metrics.uart_bytes;
  details["rejected_frames"] = metrics.rejected_frames;
  details["overwritten_frames"] = metrics.overwritten_frames;
  details["tcp_connects"] = metrics.tcp_connects;
  details["tcp_write_failures"] = metrics.tcp_write_failures;
  return serialize_bounded(document, output, capacity);
}

bool decode_client_hello(const char* json, std::size_t length,
                         char* expected_device_id, std::size_t capacity) {
  if (json == nullptr || expected_device_id == nullptr || capacity == 0 ||
      length > kMaxRecordBytes) {
    return false;
  }
  FixedAllocator<kMaxRecordBytes> allocator;
  JsonDocument document(&allocator);
  if (deserializeJson(document, json, length)) {
    return false;
  }
  if (document["protocol_version"].as<uint32_t>() != kProtocolVersion) {
    return false;
  }
  const char* message_type = document["message_type"];
  const char* device_id = document["device_id"];
  if (message_type == nullptr || std::strcmp(message_type, "CLIENT_HELLO") != 0 ||
      device_id == nullptr) {
    return false;
  }
  const std::size_t device_length = std::strlen(device_id);
  if (device_length + 1 > capacity) {
    return false;
  }
  std::memcpy(expected_device_id, device_id, device_length + 1);
  return true;
}

}  // namespace dakdash
