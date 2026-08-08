import path from "node:path";
import process from "node:process";
import { makeUniversalApp } from "@electron/universal";

const [x64_app_path, arm64_app_path, output_app_path] = process.argv.slice(2);
if (!x64_app_path || !arm64_app_path || !output_app_path) {
  throw new Error("Usage: makeUniversal.mjs <x64.app> <arm64.app> <output.app>");
}

await makeUniversalApp({
  x64AppPath: path.resolve(x64_app_path),
  arm64AppPath: path.resolve(arm64_app_path),
  outAppPath: path.resolve(output_app_path),
  mergeASARs: true,
  x64ArchFiles: "Contents/Resources/backend/**"
});
