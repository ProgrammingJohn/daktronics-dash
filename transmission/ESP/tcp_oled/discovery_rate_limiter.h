#pragma once

#include <cstddef>
#include <cstdint>

namespace dakdash {

class DiscoveryRateLimiter {
 public:
  bool allow(uint32_t now_ms) {
    if (count_ != 0 && now_ms - last_response_ms_ < 250) return false;
    if (count_ == kCapacity && now_ms - responses_[next_] < 3000) {
      return false;
    }
    responses_[next_] = now_ms;
    next_ = (next_ + 1) % kCapacity;
    if (count_ < kCapacity) ++count_;
    last_response_ms_ = now_ms;
    return true;
  }

  void reset() {
    count_ = 0;
    next_ = 0;
    last_response_ms_ = 0;
  }

 private:
  static constexpr std::size_t kCapacity = 3;
  uint32_t responses_[kCapacity]{};
  std::size_t count_{0};
  std::size_t next_{0};
  uint32_t last_response_ms_{0};
};

}  // namespace dakdash
