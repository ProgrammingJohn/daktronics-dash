#include <cassert>
#include <cstdint>

#include "serial_pipeline.h"

using dakdash::CompletedFrame;
using dakdash::LatestFrameStore;
using dakdash::SerialFramer;

int main() {
  SerialFramer framer;
  CompletedFrame frame{};
  const uint8_t stream[] = {0x55, 0x01, 'A', 'B', 0x04,
                            0x01, 'C', 'D', 0x04};
  int completed = 0;
  for (uint8_t byte : stream) {
    if (framer.push(byte, frame)) {
      ++completed;
      assert(frame.length == 2);
      assert(frame.bytes[0] == (completed == 1 ? 'A' : 'C'));
    }
  }
  assert(completed == 2);

  SerialFramer restarted;
  const uint8_t restart_stream[] = {0x01, 'X', 0x01, 'Y', 0x04};
  for (uint8_t byte : restart_stream) restarted.push(byte, frame);
  assert(frame.length == 1);
  assert(frame.bytes[0] == 'Y');

  SerialFramer oversized;
  for (int i = 0; i < 514; ++i) oversized.push(i == 0 ? 0x01 : 'X', frame);
  assert(!oversized.push(0x04, frame));
  assert(oversized.rejected_frames() == 1);

  LatestFrameStore store;
  frame.length = 1;
  frame.bytes[0] = 'Z';
  store.publish(frame, 1234);
  assert(store.state_seq() == 1);
  assert(store.received_ms() == 1234);
  assert(store.frame().bytes[0] == 'Z');

  return 0;
}
