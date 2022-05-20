#!/usr/bin/env node

const glob = require("glob");
const path = require("path");
const pbjs = require("protobufjs/cli/pbjs");
const pbts = require("protobufjs/cli/pbts");

const protobufDefsRoot = path.dirname(
  require.resolve("@cockroachlabs/crdb-protobuf-defs-22.1")
);
const protos = glob.sync("**/*.proto", { cwd: protobufDefsRoot, absolute: true });
console.log("Building JS client...");
pbjs.main([
  "--target", "static-module",
  "--wrap", "es6",
  "--strict-long",
  "--keep-case",
  "--path", protobufDefsRoot,
  "--out", "dist/protos.js",
  ...protos
]);

console.log("Building TypeScript declarations...");
pbts.main([
  "--out", "dist/protos.d.ts",
  "dist/protos.js",
]);
