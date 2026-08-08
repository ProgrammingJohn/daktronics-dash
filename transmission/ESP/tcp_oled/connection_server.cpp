#include "connection_server.h"

#include <algorithm>
#include <sys/select.h>

namespace dakdash {

ConnectionServer::ConnectionServer(uint16_t port)
    : server_(port, 1), port_(port) {}

void ConnectionServer::tick(uint32_t now_ms, bool network_ready,
                            bool address_changed, const char* device_id,
                            const char* session_id,
                            const LatestFrameStore& latest_frame) {
  if (!network_ready) {
    abandon_client();
    if (listening_) {
      server_.end();
      listening_ = false;
    }
    return;
  }

  if (address_changed || !listening_) {
    restart_listener();
  }
  if (device_id == nullptr || session_id == nullptr || device_id[0] == '\0') {
    return;
  }
  if (device_id_ != device_id || session_id_ != session_id) {
    abandon_client();
    device_id_ = device_id;
    session_id_ = session_id;
    delivery_cursor_.reset_session();
  }

  if (!client_ || !client_.connected()) {
    abandon_client();
    accept_client(now_ms);
  }
  if (!client_ || !client_.connected()) {
    return;
  }

  if (!flush_output()) {
    return;
  }
  if (state_ == ClientState::SENDING_HELLO && output_length_ == 0) {
    state_ = ClientState::ACTIVE;
    last_heartbeat_ms_ = now_ms;
  }
  if (state_ == ClientState::WAITING_HELLO) {
    read_hello(now_ms);
  } else if (state_ == ClientState::ACTIVE) {
    service_active(now_ms, latest_frame);
  }
  flush_output();
}

void ConnectionServer::set_serial_metrics(uint32_t uart_bytes,
                                           uint32_t rejected_frames) {
  metrics_.uart_bytes = uart_bytes;
  metrics_.rejected_frames = rejected_frames;
}

ClientState ConnectionServer::state() const {
  return state_;
}

const char* ConnectionServer::state_text() const {
  switch (state_) {
    case ClientState::LISTENING:
      return "LISTEN";
    case ClientState::WAITING_HELLO:
      return "HELLO";
    case ClientState::SENDING_HELLO:
      return "HELLO";
    case ClientState::ACTIVE:
      return "LIVE";
  }
  return "LISTEN";
}

const HealthMetrics& ConnectionServer::metrics() const {
  return metrics_;
}

void ConnectionServer::restart_listener() {
  abandon_client();
  if (listening_) server_.end();
  server_.begin(port_);
  server_.setNoDelay(true);
  listening_ = true;
}

void ConnectionServer::accept_client(uint32_t now_ms) {
  WiFiClient candidate = server_.accept();
  if (!candidate) return;
  client_ = candidate;
  client_.setNoDelay(true);
  client_.setTimeout(1);
  state_ = ClientState::WAITING_HELLO;
  accepted_ms_ = now_ms;
  input_length_ = 0;
  expected_record_length_ = 0;
  output_length_ = 0;
  output_offset_ = 0;
  ++metrics_.tcp_connects;
}

void ConnectionServer::read_hello(uint32_t now_ms) {
  if (now_ms - accepted_ms_ >= 2000) {
    abandon_client();
    return;
  }
  while (client_.available() > 0 && input_length_ < sizeof(input_)) {
    const std::size_t available = static_cast<std::size_t>(client_.available());
    const std::size_t capacity = sizeof(input_) - input_length_;
    const std::size_t wanted = std::min(available, capacity);
    const int received = client_.read(input_ + input_length_, wanted);
    if (received <= 0) break;
    input_length_ += static_cast<std::size_t>(received);
    if (expected_record_length_ == 0 && input_length_ >= 4) {
      const uint32_t body_length =
          (static_cast<uint32_t>(input_[0]) << 24U) |
          (static_cast<uint32_t>(input_[1]) << 16U) |
          (static_cast<uint32_t>(input_[2]) << 8U) |
          static_cast<uint32_t>(input_[3]);
      if (body_length > kMaxRecordBytes) {
        abandon_client();
        return;
      }
      expected_record_length_ = 4 + body_length;
    }
  }
  if (expected_record_length_ == 0 || input_length_ < expected_record_length_) {
    return;
  }

  char expected_device[32]{};
  if (!decode_client_hello(
          reinterpret_cast<const char*>(input_ + 4),
          expected_record_length_ - 4, expected_device,
          sizeof(expected_device)) || device_id_ != expected_device) {
    abandon_client();
    return;
  }

  char* json = reinterpret_cast<char*>(output_ + 4);
  ProtocolFields hello_fields = fields(now_ms, 0, now_ms);
  const std::size_t length =
      encode_hello_json(hello_fields, json, sizeof(output_) - 4);
  if (length == 0 || !finish_record(length)) {
    abandon_client(true);
    return;
  }
  state_ = ClientState::SENDING_HELLO;
}

void ConnectionServer::service_active(uint32_t now_ms,
                                      const LatestFrameStore& latest_frame) {
  if (output_length_ != 0) return;
  const uint32_t state_seq = latest_frame.state_seq();
  const uint32_t serial_age = state_seq == 0 ? now_ms
                                             : now_ms - latest_frame.received_ms();
  char* json = reinterpret_cast<char*>(output_ + 4);

  const DeliveryDecision delivery = delivery_cursor_.evaluate(state_seq);
  if (delivery.should_send) {
    metrics_.overwritten_frames += delivery.overwritten_frames;
    ProtocolFields snapshot_fields = fields(now_ms, state_seq, serial_age);
    const std::size_t length = encode_snapshot_json(
        snapshot_fields, latest_frame.frame(), json, sizeof(output_) - 4);
    if (length == 0 || !finish_record(length)) {
      abandon_client(true);
      return;
    }
    delivery_cursor_.mark_sent(state_seq);
    return;
  }

  if (now_ms - last_heartbeat_ms_ >= 1000) {
    ProtocolFields heartbeat_fields = fields(now_ms, state_seq, serial_age);
    const std::size_t length = encode_heartbeat_json(
        heartbeat_fields, metrics_, json, sizeof(output_) - 4);
    if (length == 0 || !finish_record(length)) {
      abandon_client(true);
      return;
    }
    last_heartbeat_ms_ = now_ms;
  }
}

bool ConnectionServer::finish_record(std::size_t body_length) {
  if (body_length > kMaxRecordBytes || output_length_ != 0) {
    return false;
  }
  output_[0] = static_cast<uint8_t>((body_length >> 24U) & 0xffU);
  output_[1] = static_cast<uint8_t>((body_length >> 16U) & 0xffU);
  output_[2] = static_cast<uint8_t>((body_length >> 8U) & 0xffU);
  output_[3] = static_cast<uint8_t>(body_length & 0xffU);
  output_length_ = body_length + 4;
  output_offset_ = 0;
  return true;
}

bool ConnectionServer::flush_output() {
  if (output_length_ == 0) return true;
  if (!client_ || !client_.connected()) {
    abandon_client();
    return false;
  }
  if (!socket_writable()) return true;
  const std::size_t remaining = output_length_ - output_offset_;
  const std::size_t chunk = std::min<std::size_t>(remaining, 256);
  const std::size_t written = client_.write(output_ + output_offset_, chunk);
  if (written != chunk) {
    abandon_client(true);
    return false;
  }
  output_offset_ += written;
  if (output_offset_ == output_length_) {
    output_length_ = 0;
    output_offset_ = 0;
  }
  return true;
}

bool ConnectionServer::socket_writable() {
  if (client_.availableForWrite() > 0) return true;
  const int descriptor = client_.fd();
  if (descriptor < 0) return false;
  fd_set write_set;
  FD_ZERO(&write_set);
  FD_SET(descriptor, &write_set);
  timeval timeout{0, 0};
  return select(descriptor + 1, nullptr, &write_set, nullptr, &timeout) > 0;
}

void ConnectionServer::abandon_client(bool write_failure) {
  if (write_failure) ++metrics_.tcp_write_failures;
  if (client_) client_.stop();
  client_ = WiFiClient();
  state_ = ClientState::LISTENING;
  input_length_ = 0;
  expected_record_length_ = 0;
  output_length_ = 0;
  output_offset_ = 0;
}

ProtocolFields ConnectionServer::fields(uint32_t now_ms, uint32_t state_seq,
                                        uint32_t serial_age_ms) {
  return ProtocolFields{device_id_.c_str(), session_id_.c_str(),
                        ++packet_seq_, state_seq, now_ms, serial_age_ms};
}

}  // namespace dakdash
