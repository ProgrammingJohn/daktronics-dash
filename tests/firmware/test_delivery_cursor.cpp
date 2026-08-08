#include <cassert>

#include "delivery_cursor.h"

int main() {
  dakdash::DeliveryCursor cursor;

  auto first = cursor.evaluate(50);
  assert(first.should_send);
  assert(first.overwritten_frames == 0);
  cursor.mark_sent(50);

  // A client disconnect does not reset the boot-session high-water mark.
  auto reconnect = cursor.evaluate(50);
  assert(!reconnect.should_send);
  assert(reconnect.overwritten_frames == 0);

  auto gap = cursor.evaluate(53);
  assert(gap.should_send);
  assert(gap.overwritten_frames == 2);
  cursor.mark_sent(53);

  cursor.reset_session();
  auto new_session = cursor.evaluate(1);
  assert(new_session.should_send);
  assert(new_session.overwritten_frames == 0);
}
