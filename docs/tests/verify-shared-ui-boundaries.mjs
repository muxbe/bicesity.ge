import { listFiles, readText, failIfAny } from "./structure-test-helpers.mjs";

const files = listFiles("src/components/ui", [".ts", ".tsx"]);
const failures = [];

for (const file of files) {
  const text = readText(file);
  if (/from\s+["']@\/features\//.test(text)) {
    failures.push(`${file}: shared UI must not import feature modules`);
  }
  if (/from\s+["']@\/app\/api\//.test(text)) {
    failures.push(`${file}: shared UI must not import API route modules`);
  }
  if (/from\s+["']@\/server\//.test(text)) {
    failures.push(`${file}: shared UI must not import server modules`);
  }
  if (/from\s+["']@\/lib\/supabase\//.test(text)) {
    failures.push(`${file}: shared UI must not import Supabase modules`);
  }
  if (/type\s+\w+Props/.test(text) && /onClose/.test(text) && !/aria-label|ariaLabel/.test(text)) {
    failures.push(`${file}: close-capable shared UI should expose an accessible label`);
  }
}

failIfAny(failures, "Shared UI boundary checks passed.");
