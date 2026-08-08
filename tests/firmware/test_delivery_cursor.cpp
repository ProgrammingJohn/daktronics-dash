#include <cassert>

#include "delivery_cursor.h"

int main() {
  dakdash::DeliveryCursor cursor;

  auto first = cursor.evaluate(50);
  assert(first.should_send);
  assert(first.overwritten_frames == 0);
  cursor.begin_delivery(50, first.overwritten_frames);
  cursor.cancel_delivery();

  // A failed/partial write must leave the current state eligible to retry.
  assert(cursor.evaluate(50).should_send);
  cursor.begin_delivery(50, 0);
  assert(cursor.complete_delivery() == 0);

  // A client disconnect does not reset the boot-session high-water mark.
  auto reconnect = cursor.evaluate(50);
  assert(!reconnect.should_send);
  assert(reconnect.overwritten_frames == 0);

  auto gap = cursor.evaluate(53);
  assert(gap.should_send);
  assert(gap.overwritten_frames == 2);
  cursor.begin_delivery(53, gap.overwritten_frames);
  assert(cursor.complete_delivery() == 2);

  cursor.reset_session();
  auto new_session = cursor.evaluate(1);
  assert(new_session.should_send);
  assert(new_session.overwritten_frames == 0);
}
