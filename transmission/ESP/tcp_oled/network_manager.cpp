#include "network_manager.h"

#include <ETH.h>
#include <WiFi.h>

#include <atomic>

namespace {

constexpr uint32_t kEventStarted = 1U << 0;
constexpr uint32_t kEventGotIp = 1U << 1;
constexpr uint32_t kEventLinkDown = 1U << 2;
std::atomic<uint32_t> network_events{0};

void network_event(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_ETH_START:
      network_events.fetch_or(kEventStarted, std::memory_order_relaxed);
      break;
    case ARDUINO_EVENT_ETH_GOT_IP:
      network_events.fetch_or(kEventGotIp, std::memory_order_relaxed);
      break;
    case ARDUINO_EVENT_ETH_DISCONNECTED:
    case ARDUINO_EVENT_ETH_STOP:
      network_events.fetch_or(kEventLinkDown, std::memory_order_relaxed);
      break;
    default:
      break;
  }
}

String device_id_from_mac(const String& mac) {
  String compact;
  compact.reserve(mac.length());
  for (std::size_t index = 0; index < mac.length(); ++index) {
    const char value = mac[index];
    if (value != ':') compact += static_cast<char>(tolower(value));
  }
  return String("wt32-") + compact;
}

}  // namespace

namespace dakdash {

void NetworkManager::begin(uint32_t now_ms) {
  WiFi.onEvent(network_event);
  state_ = NetworkState::STARTING;
  next_attempt_ms_ = now_ms;
}

void NetworkManager::tick(uint32_t now_ms) {
  const uint32_t events = network_events.exchange(0, std::memory_order_relaxed);
  if (events & kEventStarted) {
    ETH.setHostname("WT32-ETH01");
  }
  if (events & kEventLinkDown) {
    handle_link_down(now_ms);
  }
  if (events & kEventGotIp) {
    refresh_address();
    state_ = NetworkState::READY;
  }

  if (!attempt_started_ &&
      static_cast<int32_t>(now_ms - next_attempt_ms_) >= 0) {
    start_attempt(now_ms);
  }
}

bool NetworkManager::ready() const {
  return state_ == NetworkState::READY;
}

bool NetworkManager::take_address_changed() {
  const bool changed = address_changed_;
  address_changed_ = false;
  return changed;
}

NetworkState NetworkManager::state() const {
  return state_;
}

const String& NetworkManager::ip_address() const {
  return ip_address_;
}

const String& NetworkManager::mac_address() const {
  return mac_address_;
}

const String& NetworkManager::device_id() const {
  return device_id_;
}

const char* NetworkManager::state_text() const {
  switch (state_) {
    case NetworkState::STARTING:
      return "START";
    case NetworkState::WAITING_DHCP:
      return "DHCP";
    case NetworkState::READY:
      return "READY";
    case NetworkState::LINK_DOWN:
      return "DOWN";
  }
  return "DOWN";
}

void NetworkManager::start_attempt(uint32_t now_ms) {
  attempt_started_ = true;
  state_ = NetworkState::WAITING_DHCP;
  if (!ETH.begin(ETH_PHY_LAN8720, 1, 23, 18, 16,
                 ETH_CLOCK_GPIO17_OUT)) {
    attempt_started_ = false;
    state_ = NetworkState::LINK_DOWN;
    next_attempt_ms_ = now_ms + 1000;
  }
}

void NetworkManager::handle_link_down(uint32_t now_ms) {
  if (attempt_started_) {
    ETH.end();
  }
  attempt_started_ = false;
  state_ = NetworkState::LINK_DOWN;
  next_attempt_ms_ = now_ms + 1000;
}

void NetworkManager::refresh_address() {
  const String next_ip = ETH.localIP().toString();
  if (next_ip != ip_address_) {
    address_changed_ = true;
    ip_address_ = next_ip;
  }
  mac_address_ = ETH.macAddress();
  device_id_ = device_id_from_mac(mac_address_);
}

}  // namespace dakdash
