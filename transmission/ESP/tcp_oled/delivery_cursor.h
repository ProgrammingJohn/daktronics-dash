#pragma once

#include <cstdint>

namespace dakdash {

struct DeliveryDecision {
  bool should_send;
  uint32_t overwritten_frames;
};

class DeliveryCursor {
 public:
  DeliveryDecision evaluate(uint32_t state_seq) const {
    if (state_seq == 0 || state_seq <= last_sent_state_seq_) {
      return {false, 0};
    }
    const uint32_t overwritten =
        last_sent_state_seq_ == 0 ? 0 : state_seq - last_sent_state_seq_ - 1;
    return {true, overwritten};
  }

  void mark_sent(uint32_t state_seq) {
    if (state_seq > last_sent_state_seq_) last_sent_state_seq_ = state_seq;
  }

  void reset_session() { last_sent_state_seq_ = 0; }

 private:
  uint32_t last_sent_state_seq_{0};
};

}  // namespace dakdash
