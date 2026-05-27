import { spawnSync } from "node:child_process";

const commands = [
  ["node", ["docs/tests/verify-spec-wording.mjs"]],
  ["node", ["docs/tests/verify-structure-boundaries.mjs"]],
  ["node", ["docs/tests/verify-max-file-lines.mjs"]],
  ["node", ["docs/tests/verify-i18n-dictionaries.mjs"]],
  ["node", ["docs/tests/verify-repository-structure.mjs"]],
  ["node", ["docs/tests/verify-shared-ui-boundaries.mjs"]],
  ["node", ["docs/tests/verify-backend-service-boundaries.mjs"]],
  ["node", ["docs/tests/verify-reservation-api-refactor.mjs"]],
  ["node", ["docs/tests/verify-reservation-service-ownership.mjs"]],
  ["node", ["docs/tests/verify-reservation-modal-safety.mjs"]],
  ["node", ["docs/tests/verify-product-form-actions.mjs"]],
];

for (const [command, args] of commands) {
  const label = `${command} ${args.join(" ")}`;
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`\nVerification command failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nStructure baseline verification passed.");
