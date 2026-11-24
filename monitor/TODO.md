# TODO

## [x] Preset board dan pemilihan perangkat
- Memilih dari tujuh preset board: ESP8266 NodeMCU, ESP8266 OLED 0.9, ESP32 OLED 0.9, ESP32 DevKit, WeMos Mini, Lolin32 Mini, dan ESP32-CAM.

## [x] Koneksi dan monitor serial
- Menghubungkan atau memutuskan koneksi USB serial ke board yang dipilih.
- Memantau keluaran serial secara langsung dengan kontrol baud rate dan area log yang dapat dibersihkan.

## [x] Pemilihan dan upload firmware
- Memilih berkas firmware dan mengunggahnya ke board melalui koneksi serial, dengan indikator progres dan status hasil.
- Menyediakan pilihan untuk memuat `firmware/esp8266.ino.bin` bawaan portal, hanya mengizinkan target ESP8266, dan memeriksa keluarga chip terdeteksi sebelum menulis image.
