# Voice Reply

A Chrome extension (Manifest V3) that lets you highlight text on any webpage, add a
short note about how you want to respond, and get an AI-generated reply in your own
writing voice — generated via the Anthropic Claude API using your own API key.

This is meant to be run from your own local checkout, not distributed as a packaged
extension: your API key and writing samples live in the project files themselves,
not in an options page.

## Setup

### 1. Get an Anthropic API key

Create a key at [console.anthropic.com](https://console.anthropic.com/settings/keys).

### 2. Configure your API key

```sh
cp .env.example .env
```

Open `.env` and paste in your key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Install dependencies and generate `src/config.js` (this file is gitignored — it's
regenerated from `.env` and never committed):

```sh
npm install
npm run build:config
```

Re-run `npm run build:config` any time you change `.env`.

### 3. Add your writing samples

Open `src/voiceSamples.js` and replace the placeholder with a few examples of your
own writing (emails, messages, notes) — enough to capture your tone, vocabulary, and
typical sentence length. This file is committed to your checkout since it's your own
content and needs to travel with the repo.

### 4. Load the extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this project's folder

## Using it

1. Highlight any text on any webpage.
2. Click the Voice Reply icon in the toolbar.
3. The highlighted snippet appears at the top of the popup.
4. Type a short note describing how you want to reply (e.g. "say no but nicely").
5. Pick a length — Short / Medium / Long.
6. Click **Write**.
7. Click **Copy** to copy the generated reply to your clipboard, then paste it wherever you need it.

## Notes

- Direct browser calls to the Anthropic API require the
  `anthropic-dangerous-direct-browser-access: true` header (set in `background.js`).
  If this ever becomes unreliable across Chrome versions, the fix is a small relay
  server that forwards the request server-side instead of calling the API directly
  from the extension.
- Your API key never leaves your machine except in requests sent directly to
  `api.anthropic.com`.
