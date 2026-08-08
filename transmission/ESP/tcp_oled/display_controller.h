#pragma once

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>

namespace dakdash {

struct DisplayStatus {
  const char* ip;
  const char* device_id;
  const char* network;
  const char* tcp;
  uint32_t state_seq;
  uint32_t last_frame_ms;
};

class DisplayController {
 public:
  bool begin();
  void tick(uint32_t now_ms, const DisplayStatus& status);

 private:
  Adafruit_SSD1306 display_{128, 64, &Wire, -1};
  bool enabled_{false};
  uint32_t last_render_ms_{0};
  String last_signature_{};
};

}  // namespace dakdash
