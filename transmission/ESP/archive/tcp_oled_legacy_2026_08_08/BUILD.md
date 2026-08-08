# Legacy Firmware Recovery

This archive preserves the last verified raw TCP relay without embedded Wi-Fi credentials. Rebuild it with the pinned toolchain:

```bash
arduino-cli core install esp32:esp32@3.3.7
arduino-cli lib install "Adafruit BusIO@1.17.4"
arduino-cli lib install "Adafruit GFX Library@1.12.5"
arduino-cli lib install "Adafruit SSD1306@2.5.16"
arduino-cli compile --fqbn esp32:esp32:esp32 transmission/ESP/archive/tcp_oled_legacy_2026_08_08
```

For recovery flashing, use a common ground between FTDI and ESP32 and verify the FTDI UART signals are 3.3 V logic. Cross FTDI TX to ESP RX and FTDI RX to ESP TX. Disconnect the live scoreboard UART source first.

Hold GPIO0 low only while resetting or power-cycling to enter download mode. After upload, release GPIO0, then pulse EN low and release it (or power-cycle) to boot normally. Power the board from only one intended source.
