#pragma once

#include <Arduino.h>

namespace dakdash {

enum class NetworkState {
  STARTING,
  WAITING_DHCP,
  READY,
  LINK_DOWN,
};

class NetworkManager {
 public:
  void begin(uint32_t now_ms);
  void tick(uint32_t now_ms);
  bool ready() const;
  bool take_address_changed();
  NetworkState state() const;
  const String& ip_address() const;
  const String& mac_address() const;
  const String& device_id() const;
  const char* state_text() const;

 private:
  void start_attempt(uint32_t now_ms);
  void handle_link_down(uint32_t now_ms);
  void refresh_address();

  NetworkState state_{NetworkState::STARTING};
  bool attempt_started_{false};
  bool address_changed_{false};
  uint32_t next_attempt_ms_{0};
  String ip_address_{};
  String mac_address_{};
  String device_id_{};
};

}  // namespace dakdash
