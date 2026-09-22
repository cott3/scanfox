browser.runtime.onMessage.addListener((message) => {
  if (message.action === "START_SNIP") {
    initSnipper();
  } else if (message.action === "SHOW_RESULT") {
    showResultCard(message.text, message.error);
  }
});

function isUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

function showResultCard(text, error) {
  const existing = document.getElementById("qr-result-card");
  if (existing) existing.remove();

  const card = document.createElement("div");
  card.id = "qr-result-card";

  if (error) {
    card.innerHTML = `
      <div class="qr-card-header error">
        <span>Scan Failed</span>
        <button class="qr-close-btn">&times;</button>
      </div>
      <div class="qr-card-body">${escapeHtml(error)}</div>
    `;
  } else {
    const validUrl = isUrl(text);
    card.innerHTML = `
      <div class="qr-card-header success">
        <span>QR Code Detected</span>
        <button class="qr-close-btn">&times;</button>
      </div>
      <div class="qr-card-body">${escapeHtml(text)}</div>
      <div class="qr-card-actions">
        <button id="qr-copy-btn" class="qr-btn secondary">Copy Text</button>
        ${validUrl ? `<button id="qr-open-btn" class="qr-btn primary">Open Link</button>` : ''}
      </div>
    `;
  }

  document.body.appendChild(card);

  // Close Button
  card.querySelector(".qr-close-btn").addEventListener("click", () => card.remove());

  // Copy Button
  const copyBtn = card.querySelector("#qr-copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy Text"), 2000);
    });
  }

  // Open Link Button
  const openBtn = card.querySelector("#qr-open-btn");
  if (openBtn) {
    openBtn.addEventListener("click", () => {
      browser.runtime.sendMessage({ action: "OPEN_TAB", url: text });
      card.remove();
    });
  }
}

function initSnipper() {
  if (document.getElementById("qr-snipper-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "qr-snipper-overlay";

  const box = document.createElement("div");
  box.id = "qr-snipper-box";
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let startX = 0, startY = 0;
  let isDragging = false;

  overlay.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    box.style.left = `${startX}px`;
    box.style.top = `${startY}px`;
    box.style.width = "0px";
    box.style.height = "0px";
    box.style.display = "block";
  });

  overlay.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
  });

  overlay.addEventListener("mouseup", (e) => {
    if (!isDragging) return;
    isDragging = false;

    const endX = e.clientX;
    const endY = e.clientY;

    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    overlay.remove();

    if (width > 10 && height > 10) {
      browser.runtime.sendMessage({
        action: "PROCESS_SNIP",
        crop: {
          x: left,
          y: top,
          width: width,
          height: height,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight
        }
      });
    }
  });
}