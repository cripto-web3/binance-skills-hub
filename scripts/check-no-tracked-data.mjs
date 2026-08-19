import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Matches every tracked file whose basename ends exactly in .data. */
export const localOnlyDataPattern = /(^|\/)[^/]*\.data$/;

export function findTrackedLocalOnlyData(fileNames) {
  return fileNames.filter((fileName) => localOnlyDataPattern.test(fileName));
}

function main() {
  const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const blockedFiles = findTrackedLocalOnlyData(trackedFiles);

  if (blockedFiles.length > 0) {
    console.error(
      "::error::Tracked .data files are not allowed. Keep account, login, and scan data local-only.",
    );
    console.error(blockedFiles.join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log("No tracked local-only data files found.");
}

const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedFile === fileURLToPath(import.meta.url)) {
  main();
}
