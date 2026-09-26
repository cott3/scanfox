// Register Context Menu Options
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "scan-image-qr",
    title: "Scan Image for QR Code",
    contexts: ["image"]
  });

  browser.contextMenus.create({
    id: "snip-page-qr",
    title: "Select Area to Scan QR Code",
    contexts: ["page", "selection"]
  });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "scan-image-qr") {
    scanImageUrl(info.srcUrl, tab.id);
  } else if (info.menuItemId === "snip-page-qr") {
    browser.tabs.sendMessage(tab.id, { action: "START_SNIP" });
  }
});

// Trigger snip when toolbar icon is clicked
browser.action.onClicked.addListener((tab) => {
  browser.tabs.sendMessage(tab.id, { action: "START_SNIP" });
});


// Listener for background tab requests
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action === "OPEN_TAB") {
    browser.tabs.create({ url: message.url });
    return;
  }

  if (message.action === "PROCESS_SNIP") {
    const { crop } = message;
    const tabId = sender.tab.id;

    try {
      const dataUrl = await browser.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      const scaleX = bitmap.width / crop.windowWidth;
      const scaleY = bitmap.height / crop.windowHeight;

      const sx = Math.floor(crop.x * scaleX);
      const sy = Math.floor(crop.y * scaleY);
      const sw = Math.floor(crop.width * scaleX);
      const sh = Math.floor(crop.height * scaleY);

      if (sw <= 0 || sh <= 0) return;

      const canvas = new OffscreenCanvas(sw, sh);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

      const imageData = ctx.getImageData(0, 0, sw, sh);
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

      if (qrCode) {
        sendResult(tabId, qrCode.data);
      } else {
        sendResult(tabId, null, "No QR code detected in selected area.");
      }
    } catch (err) {
      sendResult(tabId, null, "Capture failed: " + err.message);
    }
  }
});

async function scanImageUrl(srcUrl, tabId) {
  try {
    const response = await fetch(srcUrl);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imageBitmap, 0, 0);

    const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

    if (qrCode) {
      sendResult(tabId, qrCode.data);
    } else {
      sendResult(tabId, null, "No QR code detected in this image.");
    }
  } catch (err) {
    sendResult(tabId, null, "Unable to process image: " + err.message);
  }
}

function sendResult(tabId, text, error = null) {
  browser.tabs.sendMessage(tabId, {
    action: "SHOW_RESULT",
    text,
    error
  });
}