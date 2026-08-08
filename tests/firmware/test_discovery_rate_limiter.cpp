#include <cassert>

#include "discovery_rate_limiter.h"

int main() {
  dakdash::DiscoveryRateLimiter limiter;
  assert(limiter.allow(0));
  assert(!limiter.allow(249));
  assert(limiter.allow(250));
  assert(limiter.allow(500));
  assert(!limiter.allow(750));
  assert(!limiter.allow(2999));
  assert(limiter.allow(3000));

  limiter.reset();
  assert(limiter.allow(10000));
}
