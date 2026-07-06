const selectionBox = document.getElementById("selection-box");
const noteInput = document.getElementById("note-input");
const lengthControl = document.getElementById("length-control");
const writeBtn = document.getElementById("write-btn");
const writeBtnLabel = document.getElementById("write-btn-label");
const errorMessage = document.getElementById("error-message");
const replySection = document.getElementById("reply-section");
const replyOutput = document.getElementById("reply-output");
const copyBtn = document.getElementById("copy-btn");
const statusMessage = document.getElementById("status-message");

let highlightedText = "";
let lengthPreference = "short";

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearError() {
  errorMessage.hidden = true;
  errorMessage.textContent = "";
}

function showStatus(message) {
  statusMessage.textContent = message;
  statusMessage.hidden = false;
}

function clearStatus() {
  statusMessage.hidden = true;
  statusMessage.textContent = "";
}

function setLoading(isLoading) {
  writeBtn.disabled = isLoading;
  writeBtn.classList.toggle("is-loading", isLoading);
  writeBtnLabel.textContent = isLoading ? "Writing..." : "Write";
}

async function loadSelection() {
  try {
    const stored = await chrome.storage.session.get("lastSelection");
    const text = stored.lastSelection || "";
    highlightedText = text;
    if (text) {
      selectionBox.textContent = text;
      selectionBox.dataset.empty = "false";
    } else {
      selectionBox.textContent = "Highlight some text on the page first.";
      selectionBox.dataset.empty = "true";
    }
  } catch (err) {
    selectionBox.textContent = "Highlight some text on the page first.";
    selectionBox.dataset.empty = "true";
  }
}

lengthControl.addEventListener("click", (event) => {
  const button = event.target.closest(".length-option");
  if (!button) return;
  lengthPreference = button.dataset.value;
  for (const option of lengthControl.querySelectorAll(".length-option")) {
    option.setAttribute("aria-checked", String(option === button));
  }
});

writeBtn.addEventListener("click", async () => {
  clearError();

  if (!highlightedText) {
    showError("Highlight some text on the page first.");
    return;
  }

  const userNote = noteInput.value.trim();
  if (!userNote) {
    showError("Add a short note on how you want to reply.");
    return;
  }

  setLoading(true);
  replySection.hidden = true;
  clearStatus();

  try {
    const response = await chrome.runtime.sendMessage({
      type: "GENERATE_REPLY",
      payload: { highlightedText, userNote, lengthPreference },
    });

    if (!response || response.type === "GENERATE_REPLY_ERROR") {
      showError(
        response?.error ||
          "Something went wrong generating the reply. Check your .env and re-run `npm run build:config`."
      );
      return;
    }

    replyOutput.value = response.reply;
    replySection.hidden = false;
  } catch (err) {
    showError("Couldn't reach the extension background service. Try reloading the extension.");
  } finally {
    setLoading(false);
  }
});

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

copyBtn.addEventListener("click", async () => {
  clearStatus();
  try {
    await copyToClipboard(replyOutput.value);
    showStatus("Copied!");
  } catch (err) {
    showStatus("Couldn't copy to clipboard.");
  }
});

loadSelection();
