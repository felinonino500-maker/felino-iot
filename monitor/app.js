let BOARDS = [];
let BAUD_RATES = [];
const $ = (id) => document.getElementById(id);
const ui = {
  boardGrid: $('boardGrid'), sideBoardName: $('sideBoardName'), sideBoardChip: $('sideBoardChip'), boardDescription: $('boardDescription'),
  connectionIndicator: $('connectionIndicator'), connectionTitle: $('connectionTitle'), connectionDescription: $('connectionDescription'),
  webserialActivity: $('webserialActivity'), activityLabel: $('activityLabel'), activityElapsed: $('activityElapsed'),
  connectButton: $('connectButton'), baudRate: $('baudRate'), consoleSubtitle: $('consoleSubtitle'), liveBadge: $('liveBadge'),
  consoleOutput: $('consoleOutput'), emptyState: $('emptyState'), clearLog: $('clearLog'), downloadLog: $('downloadLog'),
  serialForm: $('serialForm'), serialInput: $('serialInput'), sendButton: $('sendButton'),
  firmwareFile: $('firmwareFile'), chooseFile: $('chooseFile'), fileName: $('fileName'), fileDetails: $('fileDetails'),
  useBundledFirmware: $('useBundledFirmware'),
  uploadZone: $('uploadZone'), flashAddress: $('flashAddress'), eraseFlash: $('eraseFlash'), flashButton: $('flashButton'),
  progressWrap: $('progressWrap'), progressLabel: $('progressLabel'), progressPercent: $('progressPercent'), progressBar: $('progressBar'),
  flashMessage: $('flashMessage'), flashHelp: $('flashHelp'), flashHelpContent: $('flashHelpContent'), toast: $('toast'),
};
let selectedBoard = null;
let serialPort = null;
let serialReader = null;
let serialWriter = null;
let decoder = new TextDecoder();
let lineBuffer = '';
let logHistory = [];
let chosenFile = null;
let firmwareOrigin = 'user';
let connected = false;
let busy = false;
let toastTimer;
let activityTimer = null;
let activityStartedAt = 0;

function renderBoards() {
  ui.boardGrid.innerHTML = BOARDS.map((board) => `<button type="button" class="board-card${board.id === selectedBoard.id ? ' selected' : ''}" role="option" aria-selected="${board.id === selectedBoard.id}" data-board="${board.id}"><span class="board-glyph" aria-hidden="true">${board.glyph}</span><span class="board-name">${board.name}</span><span class="board-chip">${board.chip}</span></button>`).join('');
  ui.boardGrid.querySelectorAll('[data-board]').forEach((button) => button.addEventListener('click', () => selectBoard(button.dataset.board)));
}
function selectBoard(id) {
  selectedBoard = BOARDS.find((board) => board.id === id) || BOARDS[0];
  renderBoards();
  ui.sideBoardName.textContent = selectedBoard.short;
  ui.sideBoardChip.textContent = selectedBoard.chip.split(' · ')[0];
  ui.boardDescription.textContent = selectedBoard.description;
  if (connected) addLog(`Board terpilih: ${selectedBoard.name}. Koneksi serial tetap aktif.`, 'warn');
  refreshFirmwareControls();
  if (firmwareOrigin === 'bundled-esp8266' && !boardSupportsBundledFirmware()) showFlashMessage('Firmware bawaan ini hanya untuk board ESP8266. Pilih board ESP8266 untuk melanjutkan.', true);
}
function boardSupportsBundledFirmware() { return /ESP8266/i.test(selectedBoard?.chip || selectedBoard?.name || ''); }
function refreshFirmwareControls() {
  if (ui.useBundledFirmware) ui.useBundledFirmware.disabled = busy || !boardSupportsBundledFirmware();
  const incompatible = firmwareOrigin === 'bundled-esp8266' && !boardSupportsBundledFirmware();
  ui.flashButton.disabled = !chosenFile || !connected || busy || incompatible;
}
function startWebSerialActivity(label) {
  ui.webserialActivity.hidden = false;
  ui.activityLabel.textContent = label;
  if (activityTimer) return;
  activityStartedAt = Date.now();
  const refreshElapsed = () => {
    const seconds = Math.floor((Date.now() - activityStartedAt) / 1000);
    ui.activityElapsed.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  };
  refreshElapsed();
  activityTimer = setInterval(refreshElapsed, 1000);
}
function updateWebSerialActivity(label) {
  if (ui.webserialActivity.hidden) startWebSerialActivity(label);
  else ui.activityLabel.textContent = label;
}
function stopWebSerialActivity() {
  if (activityTimer) clearInterval(activityTimer);
  activityTimer = null;
  ui.webserialActivity.hidden = true;
}
function timestamp() { return new Date().toLocaleTimeString('id-ID', { hour12: false }); }
function addLog(text, type = '') {
  const empty = ui.emptyState;
  if (empty?.parentNode === ui.consoleOutput) empty.remove();
  const row = document.createElement('div');
  row.className = `log-line${type ? ` log-${type}` : ''}`;
  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = timestamp();
  row.append(time, document.createTextNode(text));
  ui.consoleOutput.appendChild(row);
  logHistory.push(`[${timestamp()}] ${text}`);
  if (logHistory.length > 4000) logHistory.splice(0, logHistory.length - 4000);
  while (ui.consoleOutput.childElementCount > 600) ui.consoleOutput.firstElementChild.remove();
  ui.consoleOutput.scrollTop = ui.consoleOutput.scrollHeight;
}
function updateConnection(isConnected) {
  connected = isConnected;
  ui.connectionIndicator.classList.toggle('connected', isConnected);
  ui.connectionTitle.textContent = isConnected ? 'Board terhubung' : 'Belum terhubung';
  ui.connectionDescription.textContent = isConnected ? `${selectedBoard.name} · USB serial siap digunakan.` : 'Pilih board lalu hubungkan USB untuk mulai membaca serial.';
  ui.connectButton.innerHTML = isConnected ? '<span class="usb-icon">×</span> Putuskan' : '<span class="usb-icon">↯</span> Hubungkan board';
  ui.connectButton.disabled = busy;
  ui.liveBadge.classList.toggle('on', isConnected);
  ui.liveBadge.innerHTML = isConnected ? '<i></i> LIVE' : '<i></i> IDLE';
  ui.consoleSubtitle.textContent = isConnected ? `${selectedBoard.chip.toUpperCase()} · ${Number(ui.baudRate.value).toLocaleString('en-US')} BAUD` : 'MENUNGGU KONEKSI USB';
  ui.serialInput.disabled = !isConnected || busy;
  ui.sendButton.disabled = !isConnected || busy;
  ui.baudRate.disabled = busy;
  refreshFirmwareControls();
}
function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('visible'), 3500);
}
function showFlashMessage(message, error = false) {
  ui.flashMessage.hidden = false;
  ui.flashMessage.classList.toggle('error', error);
  ui.flashMessage.textContent = message;
}
function updateProgress(percent, label) {
  const normalized = Math.max(0, Math.min(100, Math.floor(percent)));
  ui.progressWrap.hidden = false;
  ui.progressBar.style.width = `${normalized}%`;
  ui.progressPercent.textContent = `${normalized}%`;
  ui.progressLabel.textContent = label;
}
function serialSupported() { return 'serial' in navigator && typeof navigator.serial.requestPort === 'function'; }
async function connectSerial() {
  if (!serialSupported()) {
    showToast('Web Serial tidak tersedia. Buka halaman ini di Chrome atau Edge desktop melalui HTTPS.');
    addLog('Web Serial API tidak tersedia di browser ini.', 'warn');
    return;
  }
  startWebSerialActivity('Pilih port serial pada dialog browser…');
  try {
    serialPort = await navigator.serial.requestPort();
    updateWebSerialActivity('Membuka koneksi serial…');
    await openMonitor(serialPort, Number(ui.baudRate.value));
    updateConnection(true);
    addLog(`Terhubung ke ${selectedBoard.name} pada ${ui.baudRate.value} baud.`);
    ui.serialInput.focus();
  } catch (error) {
    if (error?.name === 'NotFoundError') return;
    console.error(error);
    updateConnection(false);
    showToast(error?.message || 'Tidak dapat membuka port serial.');
    addLog(`Koneksi gagal: ${error?.message || error}`, 'warn');
  } finally {
    stopWebSerialActivity();
  }
}
async function openMonitor(port, baudRate) {
  if (!port.readable || !port.writable) {
    updateWebSerialActivity(`Membuka port pada ${baudRate} baud…`);
    await port.open({ baudRate, bufferSize: 4096 });
  }
  serialPort = port;
  decoder = new TextDecoder();
  readSerialLoop();
}
async function readSerialLoop() {
  if (!serialPort?.readable) return;
  serialReader = serialPort.readable.getReader();
  try {
    while (true) {
      const { value, done } = await serialReader.read();
      if (done) break;
      if (value) {
        const text = decoder.decode(value, { stream: true });
        lineBuffer += text;
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() ?? '';
        lines.forEach((line) => addLog(line));
      }
    }
    if (lineBuffer) { addLog(lineBuffer); lineBuffer = ''; }
  } catch (error) {
    if (connected && !busy) {
      addLog(`Stream serial berhenti: ${error?.message || error}`, 'warn');
      updateConnection(false);
    }
  } finally {
    try { serialReader?.releaseLock(); } catch { /* Reader sudah dilepas. */ }
    serialReader = null;
  }
}
async function stopMonitor(closePort = true) {
  if (serialReader) {
    try { await serialReader.cancel(); } catch { /* Port mungkin sudah ditutup. */ }
    try { serialReader.releaseLock(); } catch { /* Lock mungkin sudah dilepas. */ }
    serialReader = null;
  }
  if (serialWriter) {
    try { serialWriter.releaseLock(); } catch { /* Writer mungkin sudah dilepas. */ }
    serialWriter = null;
  }
  if (closePort && serialPort?.readable) {
    try { await serialPort.close(); } catch (error) { console.warn('Port close:', error); }
  }
}
async function disconnectSerial() {
  startWebSerialActivity('Memutus koneksi serial…');
  try {
    await stopMonitor(true);
    serialPort = null;
    updateConnection(false);
    addLog('Port serial diputuskan.');
  } finally { stopWebSerialActivity(); }
}
async function sendSerial(event) {
  event.preventDefault();
  const text = ui.serialInput.value;
  if (!text || !connected || !serialPort?.writable) return;
  try {
    serialWriter = serialPort.writable.getWriter();
    await serialWriter.write(new TextEncoder().encode(`${text}\n`));
    serialWriter.releaseLock();
    serialWriter = null;
    addLog(`> ${text}`, 'warn');
    ui.serialInput.value = '';
  } catch (error) {
    if (serialWriter) { try { serialWriter.releaseLock(); } catch { /* ignore */ } serialWriter = null; }
    addLog(`Gagal mengirim: ${error?.message || error}`, 'warn');
  }
}
async function readFirmwareAsBinary(file) { return new Uint8Array(await file.arrayBuffer()); }
function parseAddress() {
  const raw = ui.flashAddress.value.trim().replace(/^0x/i, '');
  if (!/^[\da-f]{1,8}$/i.test(raw)) throw new Error('Alamat flash harus berupa angka hexadecimal, misalnya 00000 atau 10000.');
  return Number.parseInt(raw, 16);
}
async function flashFirmware() {
  if (!chosenFile || !serialPort || !connected || busy) return;
  let address;
  if (firmwareOrigin === 'bundled-esp8266' && !boardSupportsBundledFirmware()) {
    showFlashMessage('Firmware bawaan ini hanya untuk ESP8266. Pilih board ESP8266 sebelum flashing.', true);
    return;
  }
  try { address = parseAddress(); } catch (error) { showFlashMessage(error.message, true); return; }
  if (!chosenFile.name.toLowerCase().endsWith('.bin')) {
    showFlashMessage('Pilih image firmware berformat .bin.', true);
    return;
  }
  busy = true;
  startWebSerialActivity('Menyiapkan port untuk proses flash…');
  refreshFirmwareControls();
  ui.chooseFile.disabled = true;
  ui.connectButton.disabled = true;
  ui.progressWrap.hidden = false;
  ui.flashMessage.hidden = true;
  updateProgress(0, 'Menyiapkan port serial…');
  const port = serialPort;
  const baudrate = Number(ui.baudRate.value);
  let transport;
  let esploader;
  try {
    addLog(`Memulai flash ${chosenFile.name} pada alamat 0x${address.toString(16).toUpperCase()}.`, 'warn');
    await stopMonitor(true);
    ui.connectionDescription.textContent = 'Port sedang digunakan oleh flasher. Jangan cabut kabel USB.';
    updateProgress(3, 'Memuat flasher ESP…');
    updateWebSerialActivity('Memuat flasher ESP…');
    const { ESPLoader, Transport } = await import('https://esm.sh/esptool-js@0.7.1');
    transport = new Transport(port, true);
    const terminal = { clean() {}, writeLine(value) { addLog(String(value)); }, write(value) { if (value) addLog(String(value).replace(/\r?\n$/, '')); } };
    esploader = new ESPLoader({ transport, baudrate, terminal, debugLogging: false });
    updateWebSerialActivity('Menunggu respons bootloader ESP…');
    const chipName = await esploader.main();
    if (firmwareOrigin === 'bundled-esp8266' && !String(chipName).toUpperCase().includes('ESP8266')) throw new Error(`Firmware bawaan ini untuk ESP8266, tetapi chip yang terdeteksi adalah ${chipName}. Tidak ada data yang ditulis.`);
    addLog(`Chip terdeteksi: ${chipName}.`, 'warn');
    updateProgress(10, `Terhubung ke ${chipName}…`);
    updateWebSerialActivity(`Chip ${chipName} siap; menulis firmware…`);
    const data = await readFirmwareAsBinary(chosenFile);
    const total = data.length;
    let lastProgressUpdate = 0;
    await esploader.writeFlash({
      fileArray: [{ data, address }],
      // Opsi ini wajib pada esptool-js 0.7.1; `keep` mempertahankan header image.
      flashMode: 'keep',
      flashFreq: 'keep',
      flashSize: 'keep',
      eraseAll: ui.eraseFlash.checked,
      compress: true,
      reportProgress: (_fileIndex, written, fileTotal) => {
        const current = fileTotal || total;
        const now = performance.now();
        if (written < current && now - lastProgressUpdate < 150) return;
        lastProgressUpdate = now;
        const percent = 10 + ((written / current) * 87);
        updateProgress(percent, `Menulis firmware · ${formatBytes(written)} / ${formatBytes(current)}`);
      },
    });
    await transport.disconnect();
    transport = null;
    updateProgress(100, 'Firmware berhasil ditulis.');
    updateWebSerialActivity('Flash selesai; membuka kembali monitor serial…');
    showFlashMessage(`${chosenFile.name} berhasil di-flash ke ${chipName} pada alamat 0x${address.toString(16).toUpperCase()}.`);
    addLog('Flash selesai dengan sukses.', 'warn');
    try {
      await openMonitor(port, baudrate);
      updateConnection(true);
      addLog('Monitor serial tersambung kembali. Tekan RESET pada board untuk melihat output boot.');
    } catch (reopenError) {
      serialPort = port;
      updateConnection(false);
      addLog(`Flash selesai; buka kembali monitor secara manual: ${reopenError.message}`, 'warn');
    }
  } catch (error) {
    console.error(error);
    if (transport) {
      try { await transport.disconnect(); } catch { /* Koneksi dapat sudah terputus. */ }
      transport = null;
    }
    updateProgress(0, 'Proses flash gagal.');
    showFlashMessage(`Flash gagal: ${error?.message || error}. Periksa firmware, alamat flash, port, dan mode download board.`, true);
    addLog(`Flash gagal: ${error?.message || error}`, 'warn');
    try {
      if (port && !port.readable) {
        await openMonitor(port, baudrate);
        updateConnection(true);
      }
    } catch (reopenError) {
      serialPort = port;
      updateConnection(false);
      addLog(`Port belum dapat dibuka kembali: ${reopenError.message}`, 'warn');
    }
  } finally {
    busy = false;
    stopWebSerialActivity();
    ui.chooseFile.disabled = false;
    ui.connectButton.disabled = false;
    if (connected) updateConnection(true);
    refreshFirmwareControls();
  }
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
async function loadBundledFirmware() {
  if (!boardSupportsBundledFirmware()) {
    showFlashMessage('Firmware bawaan ini hanya tersedia untuk board ESP8266.', true);
    return;
  }
  if (!connected || !serialPort) {
    showFlashMessage('Hubungkan board ESP8266 terlebih dahulu, lalu tekan Flash firmware ini.', true);
    return;
  }
  ui.useBundledFirmware.disabled = true;
  try {
    const response = await fetch('/firmware/esp8266.ino.bin', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Berkas firmware tidak dapat dimuat (HTTP ${response.status}).`);
    const blob = await response.blob();
    if (!blob.size) throw new Error('Berkas firmware kosong.');
    chosenFile = new File([blob], 'esp8266.ino.bin', { type: 'application/octet-stream' });
    firmwareOrigin = 'bundled-esp8266';
    ui.flashAddress.value = '00000';
    ui.fileName.textContent = chosenFile.name;
    ui.fileDetails.textContent = `${formatBytes(chosenFile.size)} · Firmware bawaan ESP8266 siap dipilih`;
    ui.flashMessage.hidden = true;
    ui.progressWrap.hidden = true;
    refreshFirmwareControls();
    addLog('Firmware bawaan esp8266.ino.bin dimuat. Flash dimulai setelah validasi chip.', 'warn');
    await flashFirmware();
  } catch (error) {
    console.error(error);
    showFlashMessage(`Firmware bawaan gagal dimuat: ${error?.message || error}`, true);
  } finally {
    refreshFirmwareControls();
  }
}
function handleFirmware(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.bin')) {
    showToast('File firmware harus berformat .bin.');
    ui.firmwareFile.value = '';
    return;
  }
  chosenFile = file;
  firmwareOrigin = 'user';
  ui.fileName.textContent = file.name;
  ui.fileDetails.textContent = `${formatBytes(file.size)} · Firmware biner siap di-upload`;
  ui.flashMessage.hidden = true;
  ui.progressWrap.hidden = true;
  refreshFirmwareControls();
}
function clearConsole() {
  ui.consoleOutput.replaceChildren(ui.emptyState);
  logHistory = [];
}
function downloadConsole() {
  if (!logHistory.length) { showToast('Belum ada log untuk diunduh.'); return; }
  const blob = new Blob([logHistory.join('\n')], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `esp-serial-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

ui.connectButton.addEventListener('click', () => connected ? disconnectSerial() : connectSerial());
ui.baudRate.addEventListener('change', async () => {
  if (!connected || !serialPort) {
    ui.consoleSubtitle.textContent = `MENUNGGU KONEKSI · ${Number(ui.baudRate.value).toLocaleString('en-US')} BAUD`;
    return;
  }
  const port = serialPort;
  try {
    await stopMonitor(true);
    await openMonitor(port, Number(ui.baudRate.value));
    updateConnection(true);
    addLog(`Baud rate diubah ke ${ui.baudRate.value}.`);
  } catch (error) {
    updateConnection(false);
    addLog(`Gagal mengubah baud rate: ${error?.message || error}`, 'warn');
  }
});
ui.serialForm.addEventListener('submit', sendSerial);
ui.clearLog.addEventListener('click', clearConsole);
ui.downloadLog.addEventListener('click', downloadConsole);
ui.chooseFile.addEventListener('click', () => ui.firmwareFile.click());
ui.firmwareFile.addEventListener('change', (event) => handleFirmware(event.target.files?.[0]));
ui.useBundledFirmware.addEventListener('click', loadBundledFirmware);
ui.flashButton.addEventListener('click', flashFirmware);
ui.flashHelp.addEventListener('click', () => window.openFlashHelp?.());
ui.uploadZone.addEventListener('dragover', (event) => { event.preventDefault(); ui.uploadZone.classList.add('dragover'); });
ui.uploadZone.addEventListener('dragleave', () => ui.uploadZone.classList.remove('dragover'));
ui.uploadZone.addEventListener('drop', (event) => { event.preventDefault(); ui.uploadZone.classList.remove('dragover'); handleFirmware(event.dataTransfer.files?.[0]); });
ui.uploadZone.addEventListener('click', (event) => { if (!event.target.closest('button')) ui.firmwareFile.click(); });
ui.flashAddress.addEventListener('input', () => { ui.flashAddress.value = ui.flashAddress.value.replace(/[^\da-f]/gi, '').slice(0, 8); });
window.addEventListener('beforeunload', () => { try { serialReader?.cancel(); serialPort?.close(); } catch { /* Browser unload cleanup is best effort. */ } });
if (!serialSupported()) {
  ui.connectionDescription.textContent = 'Web Serial perlu Chrome atau Edge desktop melalui HTTPS.';
  ui.connectButton.title = 'Web Serial tidak tersedia pada browser ini.';
}
async function loadConfiguration() {
  try {
    const [boardsResponse, baudResponse, descriptionsResponse] = await Promise.all([
      fetch('/config/boards.json'),
      fetch('/config/baud-rates.json'),
      fetch('/docs/descriptions.md'),
    ]);
    if (!boardsResponse.ok || !baudResponse.ok || !descriptionsResponse.ok) throw new Error('File konfigurasi atau keterangan tidak dapat dimuat.');
    BOARDS = await boardsResponse.json();
    BAUD_RATES = await baudResponse.json();
    const descriptions = await descriptionsResponse.text();
    const markdownToHtml = (markdown) => markdown
      .replace(/^# (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h4>$1</h4>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      .replace(/(?:<li>.*?<\/li>\s*)+/gs, (list) => `<ol>${list}</ol>`)
      .split(/\n{2,}/).map((part) => /^<(?:h[34]|ol)/.test(part.trim()) ? part : `<p>${part.replace(/\n/g, '<br>')}</p>`).join('');
    const descriptionFor = (board) => {
      const escapedId = board.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = descriptions.match(new RegExp(`^## ${escapedId}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n# |$)`, 'm'));
      return match?.[1]?.trim() || board.description || 'Preset board.';
    };
    BOARDS.forEach((board) => { board.description = descriptionFor(board); });
    const helpMarkdown = descriptions.match(/^# Panduan flash\s*\n([\s\S]*)$/m)?.[1]?.trim() || '';
    const renderedHelp = markdownToHtml(helpMarkdown);
    window.flashHelpHtml = renderedHelp;
    if (ui.flashHelpContent) ui.flashHelpContent.innerHTML = renderedHelp;
    if (!Array.isArray(BOARDS) || BOARDS.length === 0 || !Array.isArray(BAUD_RATES) || BAUD_RATES.length === 0) {
      throw new Error('Format konfigurasi board atau baud rate tidak valid.');
    }
    ui.baudRate.innerHTML = BAUD_RATES.map(({ value, label }) => `<option value="${value}">${label}</option>`).join('');
    selectedBoard = BOARDS.find((board) => board.id === 'esp32-devkit') || BOARDS[0];
    renderBoards();
    selectBoard(selectedBoard.id);
    updateConnection(false);
  } catch (error) {
    console.error(error);
    showToast('Konfigurasi board atau baud rate tidak dapat dimuat.');
    addLog(`Gagal memuat konfigurasi: ${error.message}`, 'warn');
  }
}
loadConfiguration();
