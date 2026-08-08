#include "discovery_responder.h"

namespace dakdash {

DiscoveryResponder::DiscoveryResponder(uint16_t port) : port_(port) {}

void DiscoveryResponder::tick(uint32_t now_ms, bool network_ready,
                              bool address_changed, const char* device_id,
                              const char* session_id,
                              const char* ip_address) {
  if (!network_ready || device_id == nullptr || session_id == nullptr ||
      ip_address == nullptr || device_id[0] == '\0' || ip_address[0] == '\0') {
    stop();
    return;
  }
  if (address_changed) stop();
  if (!listening_) {
    listening_ = udp_.begin(port_) != 0;
    if (!listening_) return;
  }

  const int packet_size = udp_.parsePacket();
  if (packet_size <= 0) return;
  const IPAddress remote_ip = udp_.remoteIP();
  const uint16_t remote_port = udp_.remotePort();
  if (packet_size > static_cast<int>(kMaxDatagramBytes)) {
    udp_.flush();
    return;
  }
  const int received = udp_.read(input_, static_cast<std::size_t>(packet_size));
  if (received != packet_size) return;

  char nonce[17]{};
  if (!decode_discover_json(
          reinterpret_cast<const char*>(input_),
          static_cast<std::size_t>(received), device_id, nonce,
          sizeof(nonce))) {
    return;
  }

  const ProtocolFields fields{
      device_id, session_id, 0, 0, now_ms, 0};
  const std::size_t length = encode_discover_response_json(
      fields, nonce, ip_address, port_, output_, sizeof(output_));
  if (length == 0 || !rate_limiter_.allow(now_ms)) return;
  if (udp_.beginPacket(remote_ip, remote_port) == 0) return;
  const std::size_t written = udp_.write(
      reinterpret_cast<const uint8_t*>(output_), length);
  if (written != length) {
    udp_.endPacket();
    return;
  }
  udp_.endPacket();
}

void DiscoveryResponder::stop() {
  if (listening_) udp_.stop();
  listening_ = false;
  rate_limiter_.reset();
}

}  // namespace dakdash
