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

  void begin_delivery(uint32_t state_seq, uint32_t overwritten_frames) {
    pending_state_seq_ = state_seq;
    pending_overwritten_frames_ = overwritten_frames;
  }

  uint32_t complete_delivery() {
    if (pending_state_seq_ == 0) return 0;
    if (pending_state_seq_ > last_sent_state_seq_) {
      last_sent_state_seq_ = pending_state_seq_;
    }
    const uint32_t overwritten = pending_overwritten_frames_;
    cancel_delivery();
    return overwritten;
  }

  void cancel_delivery() {
    pending_state_seq_ = 0;
    pending_overwritten_frames_ = 0;
  }

  void reset_session() {
    last_sent_state_seq_ = 0;
    cancel_delivery();
  }

 private:
  uint32_t last_sent_state_seq_{0};
  uint32_t pending_state_seq_{0};
  uint32_t pending_overwritten_frames_{0};
};

}  // namespace dakdash
