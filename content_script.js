// Voice Reply content script — runs on every page.
// Captures the user's text selection so the popup can show it and send it
// along with the generated-reply request. Wrapped in try/catch so it can
// never throw an uncaught error into the host page.

function captureSelection() {
  try {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";
    if (text) {
      chrome.storage.session.set({ lastSelection: text });
    }
  } catch (err) {
    // Selection capture should never break the host page.
  }
}

document.addEventListener("mouseup", captureSelection, true);
document.addEventListener("keyup", captureSelection, true);
