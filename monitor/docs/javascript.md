# JavaScript dan dependensi ESP Portal

Dokumen ini menjelaskan berkas JavaScript, library, dan API browser yang dipakai ESP Portal. Aplikasi berjalan sebagai halaman statis dan tidak memakai proses build JavaScript.

## Alur pemuatan

`index.html` adalah entry point. Halaman memuat stylesheet `styles.css`, Vue 3 Global Build dari unpkg, lalu `view.js` sebagai ES module. `view.js` mendefinisikan komponen reusable, meminta `app-view.html` melalui `fetch`, memasang template ke `#app`, lalu mengimpor `app.js`. Setelah dimuat, `app.js` mengambil preset dari `config/boards.json` dan `config/baud-rates.json`, serta keterangan board dari `docs/descriptions.md`.

Vue diminta sebagai `vue@3` tanpa nomor patch versi yang dikunci. `esptool-js` baru dimuat ketika proses flashing dimulai. Karena keduanya berasal dari CDN, halaman memerlukan jaringan untuk mengambil library tersebut. Proyek ini tidak memakai `package.json`, bundler, ataupun dependensi npm lokal.

## `view.js` — komponen dan pemasangan tampilan

`view.js` memakai fungsi Vue `createApp`, `defineComponent`, `h`, `nextTick`, `onMounted`, `ref`, dan `watch`. Komponen `AppButton` meneruskan atribut dan slot ke tombol; `AppInput` membungkus input dan event `update:modelValue`; `AppCard` membuat wadah bagian berbentuk `section`; dan `AppModal` mengendalikan elemen native `<dialog>` serta event `close`.

Fungsi `mountPortal()` mengambil markup dari `/app-view.html`, memasang aplikasi Vue ke `#app`, lalu mengimpor `/app.js`. Jika template gagal dimuat, aplikasi mencatat error dan menampilkan pesan kegagalan kepada pengguna.

## `app.js` — logika monitor dan flasher

`app.js` menghubungkan elemen UI dengan proses utama. `loadConfiguration()` memuat konfigurasi. `connectSerial()`, `openMonitor()`, `readSerialLoop()`, dan `sendSerial()` mengelola koneksi, pembacaan, serta pengiriman data serial. `flashFirmware()` mengatur pemuatan `esptool-js`, deteksi chip dan penulisan flash; `loadBundledFirmware()` memuat firmware bawaan dan memulai alur flash.

Byte dari port serial diubah menjadi teks UTF-8 secara streaming menggunakan `TextDecoder`; teks yang dikirim diubah menjadi byte dengan `TextEncoder`. Log ditampilkan di halaman dan dapat diunduh sebagai teks. Firmware dibaca dari `File.arrayBuffer()` lalu dikirim sebagai `Uint8Array`. Status koneksi, progres flash, dan durasi aktivitas Web Serial juga diperbarui melalui DOM.

## Library dan API browser

**Vue 3 Global Build** dimuat dari `https://unpkg.com/vue@3/dist/vue.global.prod.js` dan dipakai oleh `view.js`. **`esptool-js` 0.7.1** dimuat saat flashing melalui `import('https://esm.sh/esptool-js@0.7.1')`. Kelas `ESPLoader` menangani protokol flash; `Transport` menghubungkannya ke port serial. Pemanggilan `writeFlash()` mengirim satu `Uint8Array` beserta alamat awal. Opsi `flashMode`, `flashFreq`, dan `flashSize` diatur ke `keep` agar pengaturan pada header image dipertahankan.

**Web Serial API** adalah API native browser yang dipakai untuk meminta izin port, membuka port, membaca `ReadableStream`, menulis `WritableStream`, dan menutup koneksi. Browser harus mendukung API tersebut dan halaman perlu berjalan pada konteks aman seperti HTTPS. Aplikasi memeriksa ketersediaan API sebelum menawarkan koneksi.

API native lain yang digunakan adalah `fetch` untuk memuat tampilan, konfigurasi, dan firmware; `File` serta `Blob` untuk berkas firmware dan log; `TextDecoder` serta `TextEncoder` untuk data serial; dan event DOM untuk interaksi. `Manrope` dan `DM Mono` dimuat dari Google Fonts sebagai font, bukan dependensi JavaScript. Tampilan aplikasi lainnya memakai CSS di `styles.css`; Tailwind CSS tidak dimuat oleh entry point ini.

## Berkas data pendamping

`config/boards.json` menyediakan preset board, sedangkan `config/baud-rates.json` menyediakan pilihan baud rate. `docs/descriptions.md` menyimpan keterangan board serta panduan flash yang dimuat oleh `app.js`. `app-view.html` berisi struktur markup yang dipasang oleh Vue. `firmware/esp8266.ino.bin` adalah firmware bawaan untuk opsi flash ESP8266.

## Catatan pengembangan

Keberhasilan membuka port atau mendeteksi chip tidak memastikan penulisan firmware berhasil. Proses flash juga bergantung pada kecocokan firmware dan alamat, mode boot, komunikasi dengan chip flash, daya, serta kondisi perangkat keras. Pengujian tanpa board fisik tidak membuktikan USB flashing berhasil.
