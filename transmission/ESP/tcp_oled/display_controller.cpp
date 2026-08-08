#include "display_controller.h"

namespace dakdash {

bool DisplayController::begin() {
  enabled_ = display_.begin(SSD1306_SWITCHCAPVCC, 0x3c);
  return enabled_;
}

void DisplayController::tick(uint32_t now_ms, const DisplayStatus& status) {
  if (!enabled_ || now_ms - last_render_ms_ < 250) return;
  last_render_ms_ = now_ms;
  const bool activity = status.state_seq != 0 &&
                        now_ms - status.last_frame_ms < 250;
  String signature = String(status.ip) + '|' + status.device_id + '|' +
                     status.network + '|' + status.tcp + '|' +
                     String(status.state_seq) + '|' + String(activity);
  if (signature == last_signature_) return;
  last_signature_ = signature;

  display_.clearDisplay();
  display_.setTextColor(SSD1306_WHITE);
  display_.setTextSize(2);
  display_.setCursor(22, 0);
  display_.println("DakDash");
  display_.setTextSize(1);
  display_.setCursor(0, 19);
  display_.print("IP ");
  display_.println(status.ip);
  display_.setCursor(0, 29);
  display_.print("ID ");
  const String id(status.device_id);
  display_.println(id.length() > 13 ? id.substring(id.length() - 13) : id);
  display_.setCursor(0, 39);
  display_.print("NET ");
  display_.print(status.network);
  display_.print(" TCP ");
  display_.println(status.tcp);
  display_.setCursor(0, 49);
  display_.print("SER ");
  display_.print(status.state_seq == 0 ? "WAIT" : "FRAME ");
  if (status.state_seq != 0) display_.println(status.state_seq);
  if (activity) display_.fillRect(0, 0, 5, 5, SSD1306_WHITE);
  display_.display();
}

}  // namespace dakdash
