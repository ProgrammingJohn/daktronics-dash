#include <cassert>
#include <cstring>
#include <string>

#include "connection_protocol.h"

namespace {

std::string request(const char* device_id, const char* message_type,
                    const char* nonce, int version = 1) {
  return std::string("{\"details\":{\"nonce\":\"") + nonce +
         "\"},\"device_id\":\"" + device_id +
         "\",\"message_type\":\"" + message_type +
         "\",\"packet_seq\":0,\"payload\":\"\","
         "\"payload_crc32\":0,\"protocol_version\":" +
         std::to_string(version) +
         ",\"serial_age_ms\":0,\"session_id\":\"\","
         "\"state_seq\":0,\"uptime_ms\":0}";
}

}  // namespace

int main() {
  const char* device_id = "wt32-aabbccddeeff";
  char nonce[17]{};

  std::string valid = request(
      device_id, "DISCOVER", "0011223344556677");
  assert(dakdash::decode_discover_json(
      valid.c_str(), valid.size(), device_id, nonce, sizeof(nonce)));
  assert(std::strcmp(nonce, "0011223344556677") == 0);

  std::string any_device = request(
      "", "DISCOVER", "0011223344556677");
  assert(!dakdash::decode_discover_json(
      any_device.c_str(), any_device.size(), device_id, nonce, sizeof(nonce)));

  for (const std::string& invalid : {
           request("wt32-001122334455", "DISCOVER", "0011223344556677"),
           request(device_id, "HELLO", "0011223344556677"),
           request(device_id, "DISCOVER", "short"),
           request(device_id, "DISCOVER", "001122334455667g"),
           request(device_id, "DISCOVER", "0011223344556677", 2),
       }) {
    assert(!dakdash::decode_discover_json(
        invalid.c_str(), invalid.size(), device_id, nonce, sizeof(nonce)));
  }

  dakdash::ProtocolFields fields{
      device_id, "boot-1234", 0, 0, 2500, 4};
  char output[dakdash::kMaxDatagramBytes + 1]{};
  const std::size_t length = dakdash::encode_discover_response_json(
      fields, "0011223344556677", "10.93.37.138", 1234,
      output, sizeof(output));
  assert(length > 0 && length <= dakdash::kMaxDatagramBytes);
  assert(std::strstr(output, "\"message_type\":\"DISCOVER_RESPONSE\"") != nullptr);
  assert(std::strstr(output, "\"nonce\":\"0011223344556677\"") != nullptr);
  assert(std::strstr(output, "\"ip\":\"10.93.37.138\"") != nullptr);
  assert(std::strstr(output, "\"port\":1234") != nullptr);
}
