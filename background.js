// Voice Reply background service worker.
// Holds the only code in this extension that talks to the Claude API.
// ANTHROPIC_API_KEY and VOICE_SAMPLES are bundled in at load time from
// project files that live outside version control (see README) — there is
// no runtime settings UI and no chrome.storage.local involved for either.
import { ANTHROPIC_API_KEY } from "./src/config.js";
import { VOICE_SAMPLES } from "./src/voiceSamples.js";

// chrome.storage.session is restricted to trusted contexts (background,
// popup) by default — content scripts can't read or write it until a
// trusted context explicitly grants access. Without this, the content
// script's writes to `lastSelection` silently fail and the popup never
// sees the highlighted text.
chrome.storage.session
  .setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
  .catch(() => {});

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

const LENGTH_GUIDANCE = {
  short: "a sentence or less",
  medium: "2-3 sentences",
  long:
    "a full paragraph or more — if it naturally spans multiple paragraphs, separate " +
    "each paragraph with a blank line (two newlines) so the structure is easy to read",
};

const MAX_TOKENS_BY_LENGTH = {
  short: 150,
  medium: 350,
  long: 700,
};

function buildSystemPrompt(voiceSamples) {
  return (
    "You write replies in the voice of the user based on writing samples they've provided. " +
    "Study these samples for tone, vocabulary, sentence length, and quirks:\n\n" +
    `${voiceSamples}\n\n` +
    "One specific quirk to match exactly: the user never uses commas. Never use a comma in the " +
    "reply — instead join clauses with connector words like \"and\", \"so\", \"since\", \"but\", " +
    "and \"tho\" (as seen in the samples), or just break into a new line/sentence. " +
    "When given a message someone sent them and notes on what they want to say back, draft a " +
    "natural reply that sounds like the user wrote it themselves. You'll also be told a desired " +
    "length (short/medium/long) — a short reply is a sentence or less, medium is 2-3 sentences, " +
    "long is a full paragraph or more (separate multiple paragraphs with a blank line). Output " +
    "only the reply text, nothing else — no preamble, no quotation marks around it."
  );
}

async function generateReply({ highlightedText, userNote, lengthPreference }) {
  const length = LENGTH_GUIDANCE[lengthPreference] ? lengthPreference : "medium";
  const maxTokens = MAX_TOKENS_BY_LENGTH[length];

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      // Required for direct browser -> Anthropic API calls; otherwise CORS
      // blocks the request. If this ever stops being reliable across
      // browsers, the fix is a small relay server that forwards the request
      // server-side and keeps this header (and the key) off the client.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: buildSystemPrompt(VOICE_SAMPLES),
      messages: [
        {
          role: "user",
          content:
            `Here is the message I'm replying to:\n"""${highlightedText}"""\n\n` +
            `Here are my notes on how I want to reply:\n${userNote}\n\n` +
            `Desired reply length: ${length}\n\n` +
            "Write the reply in my voice, ready to send as-is.",
        },
      ],
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message || "";
    } catch (err) {
      // Response body wasn't JSON — ignore, fall back to status text below.
    }

    if (response.status === 401) {
      throw new Error(
        "Invalid API key. Check your .env file and re-run `npm run build:config`."
      );
    }
    if (response.status === 429) {
      throw new Error("Rate limited by the Anthropic API. Wait a moment and try again.");
    }
    throw new Error(detail || `Claude API request failed (${response.status}).`);
  }

  const data = await response.json();
  const text = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Claude API returned an empty response.");
  }

  return text;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "GENERATE_REPLY") {
    generateReply(message.payload)
      .then((reply) => sendResponse({ type: "GENERATE_REPLY_SUCCESS", reply }))
      .catch((err) =>
        sendResponse({
          type: "GENERATE_REPLY_ERROR",
          error: err && err.message ? err.message : "Unknown error generating reply.",
        })
      );
    return true; // keep the message channel open for the async response
  }
  return false;
});

const CONTEXT_MENU_ID = "voice-reply";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Reply with Voice Reply",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) return;

  try {
    await chrome.storage.session.set({ lastSelection: info.selectionText.trim() });
  } catch (err) {
    // If this fails the popup will just show its empty-selection placeholder.
  }

  try {
    // chrome.action.openPopup() needs Chrome 127+ and a user gesture — a
    // context-menu click qualifies, but the API may not exist on older
    // Chrome versions, hence the try/catch below.
    await chrome.action.openPopup();
  } catch (err) {
    // Fallback: open the same popup UI in a small floating window, which
    // works on every Chrome version regardless of openPopup() support.
    chrome.windows.create({
      url: chrome.runtime.getURL("popup/popup.html"),
      type: "popup",
      width: 400,
      height: 620,
    });
  }
});
