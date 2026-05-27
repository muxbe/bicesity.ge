import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const repoRoot = process.cwd();

export function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

export function absolutePath(relativePath) {
  return path.join(repoRoot, relativePath);
}

export function pathExists(relativePath) {
  return existsSync(absolutePath(relativePath));
}

export function readText(relativePath) {
  return readFileSync(absolutePath(relativePath), "utf8");
}

export function listFiles(relativeDir, extensions = [".ts", ".tsx", ".js", ".mjs"]) {
  const root = absolutePath(relativeDir);
  if (!existsSync(root)) {
    return [];
  }

  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (extensions.includes(path.extname(fullPath))) {
        files.push(toPosixPath(path.relative(repoRoot, fullPath)));
      }
    }
  };

  visit(root);
  return files.sort();
}

export function lineCount(relativePath) {
  const text = readText(relativePath);
  if (!text) {
    return 0;
  }
  return text.split(/\r?\n/).length;
}

export function failIfAny(failures, successMessage) {
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(successMessage);
}
