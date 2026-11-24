# Keterangan board

## esp8266-nodemcu
Preset untuk ESP8266 NodeMCU. Chip dideteksi otomatis oleh flasher.

## esp8266-oled
Preset untuk ESP8266 dengan layar OLED 0.9 inci.

## esp32-oled
Preset untuk ESP32 dengan layar OLED 0.9 inci.

## esp32-devkit
Preset untuk board ESP32 DevKit.

## wemos-mini
Preset untuk WeMos D1 Mini berbasis ESP8266.

## lolin32-mini
Preset untuk board Lolin32 Mini berbasis ESP32.

## esp32cam
Preset untuk ESP32-CAM. Umumnya memerlukan adaptor USB-to-TTL eksternal.

# Panduan flash lewat Web Serial

## Prasyarat
Gunakan Chrome atau Edge versi desktop yang mendukung Web Serial API. Halaman harus dibuka pada konteks aman HTTPS; `localhost` juga dapat digunakan untuk pengembangan. Hubungkan board dengan kabel USB yang mendukung data, bukan kabel daya saja. Tutup aplikasi serial lain yang sedang memakai port tersebut.

## Langkah di ESP Portal
1. Pilih preset board yang sesuai. Preset membantu mengenali board; chip tetap dideteksi saat flasher berkomunikasi dengan bootloader.
2. Pilih baud rate. Mulai dengan `115200` jika koneksi tidak stabil atau board sulit masuk mode download.
3. Tekan **Hubungkan board**, lalu pilih port USB serial pada dialog izin browser. Pemilih port harus dibuka akibat tindakan klik pengguna.
4. Pilih berkas firmware lokal `.bin`, atau tekan **Flash firmware ini** untuk langsung memuat dan mem-flash `firmware/esp8266.ino.bin`. Tombol firmware bawaan memerlukan koneksi serial aktif, hanya untuk ESP8266, dan chip yang terdeteksi diperiksa sebelum penulisan.
5. Saat firmware bawaan dipilih, alamat awal diisi `0x00000`. Tetap cocokkan alamat dengan instruksi build/paket yang menghasilkan berkas tersebut. Untuk firmware lokal, masukkan offset yang ditentukan paket; image gabungan ESP8266 sering memakai `0x00000`, sedangkan firmware ESP32 dapat memerlukan offset lain, misalnya image aplikasi di `0x10000`. Jangan menebak offset.
6. Biarkan **Hapus seluruh flash** tidak dicentang kecuali instruksi firmware meminta penghapusan penuh. Penghapusan dapat menghapus konfigurasi, data, dan partisi lain.
7. Tekan **Mulai flash**. Halaman menyerahkan port serial ke `esptool-js`, mendeteksi chip, menulis image, dan menampilkan progres. Jangan cabut USB atau menutup halaman sampai hasil berhasil/gagal muncul.
8. Setelah berhasil, monitor serial dibuka kembali. Tekan tombol RESET/EN pada board bila ingin membaca log boot firmware baru.

## Mode boot dan pemilihan port
Pada board dengan auto-reset, esptool-js biasanya mengatur reset dan masuk ke bootloader melalui sinyal serial. Jika koneksi bootloader gagal, coba tekan dan tahan **BOOT/FLASH**, klik **Mulai flash**, lalu lepaskan setelah proses koneksi dimulai. Pada ESP32-CAM, pasang GPIO0 ke GND untuk masuk mode download, mulai flashing, kemudian lepaskan jumper dan reset board setelah selesai. Perhatikan pinout board dan adaptor USB-to-TTL; sambungkan TX ke RX, RX ke TX, GND bersama, dan gunakan tegangan logika 3.3 V. Jangan memberi 5 V ke pin 3.3 V.

## Catatan format firmware
ESP Portal saat ini menerima satu berkas biner `.bin` dan menulisnya pada satu alamat yang diisi di kolom **FLASH ADDRESS**. Banyak paket ESP-IDF memerlukan beberapa berkas pada offset berbeda (contoh bootloader, partition table, dan aplikasi); satu image aplikasi bukan selalu pengganti image gabungan. Jika paket menyediakan beberapa berkas/offset, gunakan image gabungan yang memang ditujukan untuk flashing satu berkas, atau gabungkan/flash dengan alat yang mendukung beberapa image. Jangan mengunggah satu berkas pada offset `0x00000` hanya karena kolom memakai nilai awal tersebut.

## Troubleshooting
- **Port tidak terlihat:** cabut-pasang USB, coba kabel data/port USB lain, periksa driver USB-serial, lalu tutup Serial Monitor IDE atau aplikasi lain.
- **Browser tidak menyediakan pemilih port:** buka halaman di Chrome/Edge desktop melalui HTTPS; Web Serial tidak tersedia di semua browser atau WebView ponsel.
- **Failed to connect / timed out:** pastikan board memakai port yang dipilih, turunkan baud rate, coba tombol BOOT/FLASH, dan pastikan board masuk mode download.
- **Chip terdeteksi tetapi flashing gagal:** periksa bahwa `.bin` cocok dengan keluarga chip, offset benar, dan daya USB stabil. Coba baud lebih rendah.
- **Flash berhasil tetapi aplikasi tidak jalan:** periksa apakah firmware membutuhkan image partition/bootloader tambahan dan apakah offset image sesuai dokumentasi firmware. Tekan RESET/EN setelah flashing.
- **Jangan lanjutkan saat ragu:** hentikan dan cari petunjuk flashing resmi untuk nama board, keluarga chip, serta versi firmware yang tepat.

Flashing mengubah isi memori perangkat dan pemilihan image atau offset yang keliru dapat membuat board tidak boot. Pastikan firmware berasal dari sumber tepercaya dan cocok dengan board.
