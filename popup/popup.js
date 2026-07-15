const selectionBox = document.getElementById("selection-box");
const noteInput = document.getElementById("note-input");
const lengthControl = document.getElementById("length-control");
const ideasBtn = document.getElementById("ideas-btn");
const ideasBtnLabel = document.getElementById("ideas-btn-label");
const ideasSection = document.getElementById("ideas-section");
const ideasList = document.getElementById("ideas-list");
const writeBtn = document.getElementById("write-btn");
const writeBtnLabel = document.getElementById("write-btn-label");
const errorMessage = document.getElementById("error-message");
const replySection = document.getElementById("reply-section");
const replyOutput = document.getElementById("reply-output");
const copyBtn = document.getElementById("copy-btn");
const statusMessage = document.getElementById("status-message");

let highlightedText = "";
let lengthPreference = "short";

const LENGTH_CYCLE = ["short", "medium", "long"];

function setLengthPreference(value) {
  lengthPreference = value;
  for (const option of lengthControl.querySelectorAll(".length-option")) {
    option.setAttribute("aria-checked", String(option.dataset.value === value));
  }
}

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
  ideasBtn.disabled = isLoading;
}

function setIdeasLoading(isLoading) {
  ideasBtn.disabled = isLoading;
  ideasBtn.classList.toggle("is-loading", isLoading);
  ideasBtnLabel.textContent = isLoading ? "Generating..." : "Ideas";
  writeBtn.disabled = isLoading;
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

noteInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    writeBtn.click();
  }
});

lengthControl.addEventListener("click", (event) => {
  const button = event.target.closest(".length-option");
  if (!button) return;
  setLengthPreference(button.dataset.value);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Tab" || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }
  event.preventDefault();
  const step = event.shiftKey ? -1 : 1;
  const currentIndex = LENGTH_CYCLE.indexOf(lengthPreference);
  const nextIndex = (currentIndex + step + LENGTH_CYCLE.length) % LENGTH_CYCLE.length;
  setLengthPreference(LENGTH_CYCLE[nextIndex]);
});

function renderIdeas(ideas) {
  ideasList.innerHTML = "";
  for (const idea of ideas) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "idea-option";
    option.textContent = idea;
    option.addEventListener("click", () => {
      noteInput.value = idea;
      ideasSection.hidden = true;
      noteInput.focus();
    });
    ideasList.appendChild(option);
  }
  ideasSection.hidden = false;
}

ideasBtn.addEventListener("click", async () => {
  clearError();

  if (!highlightedText) {
    showError("Highlight some text on the page first.");
    return;
  }

  setIdeasLoading(true);
  ideasSection.hidden = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "GENERATE_IDEAS",
      payload: { highlightedText, userNote: noteInput.value.trim() },
    });

    if (!response || response.type === "GENERATE_IDEAS_ERROR") {
      showError(
        response?.error ||
          "Something went wrong generating ideas. Check your .env and re-run `npm run build:config`."
      );
      return;
    }

    renderIdeas(response.ideas);
  } catch (err) {
    showError("Couldn't reach the extension background service. Try reloading the extension.");
  } finally {
    setIdeasLoading(false);
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
