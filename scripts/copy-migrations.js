// Cross-platform replacement for `mkdir -p ... && cp ...` (that shell syntax
// doesn't run under Windows' default cmd.exe — see the build step in
// package.json). Copies the migration .sql files next to the compiled JS
// so runMigrations() can find them at runtime from dist/.
const fs = require("node:fs");
const path = require("node:path");

const srcDir = path.join(__dirname, "..", "src", "shared", "db", "migrations");
const destDir = path.join(__dirname, "..", "dist", "shared", "db", "migrations");

fs.mkdirSync(destDir, { recursive: true });

for (const file of fs.readdirSync(srcDir)) {
  if (file.endsWith(".sql")) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
}
