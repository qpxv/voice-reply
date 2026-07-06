const fs = require("fs");
const path = require("path");
require("dotenv").config();

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey || apiKey === "your-key-here") {
  console.error("ANTHROPIC_API_KEY is missing from .env. Copy .env.example to .env and fill in your key.");
  process.exit(1);
}

const outPath = path.join(__dirname, "src", "config.js");
const contents = `export const ANTHROPIC_API_KEY = ${JSON.stringify(apiKey)};\n`;

fs.writeFileSync(outPath, contents);
console.log(`Wrote ${outPath}`);
