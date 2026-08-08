#include <cstring>
#include <iostream>
#include <string>

#include "connection_protocol.h"

using dakdash::CompletedFrame;
using dakdash::HealthMetrics;
using dakdash::ProtocolFields;

int main(int argc, char** argv) {
  const std::string mode = argc > 1 ? argv[1] : "snapshot";
  if (mode == "decode") {
    const char hello[] =
        "{\"details\":{},\"device_id\":\"wt32-aabbccddeeff\","
        "\"message_type\":\"CLIENT_HELLO\",\"packet_seq\":0,"
        "\"payload\":\"\",\"payload_crc32\":0,\"protocol_version\":1,"
        "\"serial_age_ms\":0,\"session_id\":\"\",\"state_seq\":0,"
        "\"uptime_ms\":0}";
    char expected[32]{};
    if (!dakdash::decode_client_hello(hello, std::strlen(hello), expected,
                                      sizeof(expected))) {
      return 2;
    }
    std::cout << expected;
    return 0;
  }
  if (mode == "decode-discover") {
    const char request[] =
        "{\"details\":{\"nonce\":\"0011223344556677\"},"
        "\"device_id\":\"wt32-aabbccddeeff\","
        "\"message_type\":\"DISCOVER\",\"packet_seq\":0,"
        "\"payload\":\"\",\"payload_crc32\":0,\"protocol_version\":1,"
        "\"serial_age_ms\":0,\"session_id\":\"\",\"state_seq\":0,"
        "\"uptime_ms\":0}";
    char nonce[17]{};
    if (!dakdash::decode_discover_json(
            request, std::strlen(request), "wt32-aabbccddeeff",
            nonce, sizeof(nonce))) {
      return 4;
    }
    std::cout << nonce;
    return 0;
  }

  ProtocolFields fields{"wt32-aabbccddeeff", "boot-1234", 9, 7, 2500, 4};
  char output[2048]{};
  std::size_t length = 0;
  if (mode == "hello") {
    length = dakdash::encode_hello_json(fields, output, sizeof(output));
  } else if (mode == "heartbeat") {
    HealthMetrics metrics{100, 2, 3, 4, 5};
    length = dakdash::encode_heartbeat_json(fields, metrics, output,
                                             sizeof(output));
  } else if (mode == "discover-response") {
    length = dakdash::encode_discover_response_json(
        fields, "0011223344556677", "10.93.37.138", 1234,
        output, sizeof(output));
  } else {
    CompletedFrame frame{};
    const char payload[] = "12:00HOME";
    frame.length = sizeof(payload) - 1;
    std::memcpy(frame.bytes.data(), payload, frame.length);
    length = dakdash::encode_snapshot_json(fields, frame, output,
                                            sizeof(output));
  }
  if (length == 0) {
    return 3;
  }
  std::cout.write(output, static_cast<std::streamsize>(length));
  return 0;
}
