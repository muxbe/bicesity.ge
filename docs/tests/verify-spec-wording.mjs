import { listFiles, readText, failIfAny } from "./structure-test-helpers.mjs";

const defaultFiles = [
  ...listFiles("docs/specs", [".md"]).filter((file) => /structure-refactor\.md$/.test(file)),
  ...listFiles("docs/audits", [".md"]).filter((file) => /structure-spec-conflict-audit\.md$/.test(file)),
];

const files = process.argv.slice(2);
const targetFiles = files.length > 0 ? files : defaultFiles;

const blockedWords = [
  ["T" + "BD", "incomplete marker"],
  ["TO" + "DO", "incomplete marker"],
  ["place" + "holder", "draft wording"],
  ["may" + "be", "uncertain wording"],
  ["event" + "ually", "uncertain wording"],
  ["where " + "practical", "uncertain wording"],
  ["if " + "useful", "uncertain wording"],
];

const bannedPatterns = blockedWords.map(([word, label]) => ({
  pattern: new RegExp(`\\b${word.replaceAll(" ", "\\s+")}\\b`, "i"),
  label,
}));

const failures = [];

for (const file of targetFiles) {
  const text = readText(file);
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of bannedPatterns) {
      if (rule.pattern.test(line)) {
        failures.push(`${file}:${index + 1} contains ${rule.label}: ${line.trim()}`);
      }
    }
  });
}

failIfAny(failures, "Spec wording checks passed.");
