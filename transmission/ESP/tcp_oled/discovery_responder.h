#pragma once

#include <Arduino.h>
#include <WiFiUdp.h>

#include "connection_protocol.h"
#include "discovery_rate_limiter.h"

namespace dakdash {

class DiscoveryResponder {
 public:
  explicit DiscoveryResponder(uint16_t port = 1234);
  void tick(uint32_t now_ms, bool network_ready, bool address_changed,
            const char* device_id, const char* session_id,
            const char* ip_address);

 private:
  void stop();

  WiFiUDP udp_{};
  uint16_t port_;
  bool listening_{false};
  uint8_t input_[kMaxDatagramBytes + 1]{};
  char output_[kMaxDatagramBytes + 1]{};
  DiscoveryRateLimiter rate_limiter_{};
};

}  // namespace dakdash
