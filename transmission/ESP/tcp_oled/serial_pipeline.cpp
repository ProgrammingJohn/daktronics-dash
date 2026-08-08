#include "serial_pipeline.h"

namespace dakdash {

namespace {
constexpr uint8_t kStartOfHeader = 0x01;
constexpr uint8_t kEndOfTransmission = 0x04;
}  // namespace

bool SerialFramer::push(uint8_t byte, CompletedFrame& completed) {
  if (byte == kStartOfHeader) {
    building_.length = 0;
    in_frame_ = true;
    overflowed_ = false;
    return false;
  }

  if (!in_frame_) {
    return false;
  }

  if (byte == kEndOfTransmission) {
    in_frame_ = false;
    if (overflowed_) {
      ++rejected_frames_;
      overflowed_ = false;
      building_.length = 0;
      return false;
    }
    completed = building_;
    building_.length = 0;
    return true;
  }

  if (overflowed_) {
    return false;
  }
  if (building_.length == kMaxPayloadBytes) {
    overflowed_ = true;
    return false;
  }
  building_.bytes[building_.length++] = byte;
  return false;
}

uint32_t SerialFramer::rejected_frames() const {
  return rejected_frames_;
}

void LatestFrameStore::publish(const CompletedFrame& frame,
                               uint32_t received_ms) {
  frame_ = frame;
  received_ms_ = received_ms;
  ++state_seq_;
}

const CompletedFrame& LatestFrameStore::frame() const {
  return frame_;
}

uint32_t LatestFrameStore::state_seq() const {
  return state_seq_;
}

uint32_t LatestFrameStore::received_ms() const {
  return received_ms_;
}

}  // namespace dakdash
