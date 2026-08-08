#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace dakdash {

constexpr std::size_t kMaxPayloadBytes = 512;

struct CompletedFrame {
  std::array<uint8_t, kMaxPayloadBytes> bytes{};
  std::size_t length{0};
};

class SerialFramer {
 public:
  bool push(uint8_t byte, CompletedFrame& completed);
  uint32_t rejected_frames() const;

 private:
  CompletedFrame building_{};
  bool in_frame_{false};
  bool overflowed_{false};
  uint32_t rejected_frames_{0};
};

class LatestFrameStore {
 public:
  void publish(const CompletedFrame& frame, uint32_t received_ms);
  const CompletedFrame& frame() const;
  uint32_t state_seq() const;
  uint32_t received_ms() const;

 private:
  CompletedFrame frame_{};
  uint32_t state_seq_{0};
  uint32_t received_ms_{0};
};

}  // namespace dakdash
