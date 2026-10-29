#!/usr/bin/env node
// Rebuilds the Lock In packages and packs them into vendor/, so a clone of this repo
// (Vercel's, or anyone's) installs the design system without the Lock In repo beside it.
//
//   npm run vendor:lockin                         # expects ../../Design System Lock In
//   npm run vendor:lockin -- "/path/to/lock-in"   # or give the path
//
// Then run `npm install` and commit vendor/, package.json and package-lock.json.
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockIn = path.resolve(process.argv[2] ?? path.join(root, "../../Design System Lock In"));
const vendor = path.join(root, "vendor");

// Build order matters: @lockin/react builds against the other two.
const packages = ["tokens", "icons", "react"];

const run = (command, cwd) => execSync(command, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });

mkdirSync(vendor, { recursive: true });
for (const file of readdirSync(vendor)) if (/^lockin-.*\.tgz$/.test(file)) rmSync(path.join(vendor, file));

const tarballs = {};
for (const name of packages) {
  console.log(`Building @lockin/${name}…`);
  run(`npm run build -w @lockin/${name}`, lockIn);
  // npm prints the tarball's file name last.
  const out = run(`npm pack --loglevel=error --pack-destination "${vendor}"`, path.join(lockIn, "packages", name));
  tarballs[name] = out.trim().split(/\r?\n/).at(-1);
  console.log(`  -> vendor/${tarballs[name]}`);
}

const packageJsonPath = path.join(root, "package.json");
const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
for (const name of packages) pkg.dependencies[`@lockin/${name}`] = `file:vendor/${tarballs[name]}`;
writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log("\nDone. Now run `npm install`, then commit vendor/, package.json and package-lock.json.");
