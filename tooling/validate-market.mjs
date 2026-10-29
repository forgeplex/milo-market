import assert from "node:assert/strict";
import { readFile, readdir, lstat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import YAML from "yaml";
import { validateCategories } from "./categories.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const json = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));
const skills = await json("catalog/skills.json");
const validate = new Ajv().compile(await json("schemas/skills.schema.json"));
assert(validate(skills), JSON.stringify(validate.errors));
const seen = new Set();
async function local(path) {
 const full = resolve(root, path);
 assert(!relative(root, full).startsWith(".."), "Path escapes repository");
 const info = await lstat(full); assert(!info.isSymbolicLink(), "Symlinks are not supported");
 if (info.isDirectory()) for (const item of await readdir(full)) await local(`${path}/${item}`);
 else assert(!/(^|\/)(\.env|.*\.pem|.*\.key)$/.test(path), "Secret file is not allowed");
}
async function skill(path, expected) {
 await local(path);
 const text = await readFile(resolve(root,path,"SKILL.md"), "utf8");
 const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/); assert(match, path);
 const meta = YAML.parse(match[1]); assert.equal(meta.name, path.split("/").at(-1));
 assert(meta.description && meta.name.length <= 64); assert(meta.license);
 if(expected) assert.equal(meta.description, expected);
}
for(const entry of skills.skills) {
 assert(!seen.has(`skill:${entry.id}`)); seen.add(`skill:${entry.id}`);
 if(entry.source.repository) assert(/^[a-f0-9]{40}$/.test(entry.source.sha));
 else await skill(entry.source.path,entry.description);
}
const market=await json(".agents/plugins/marketplace.json");
const validateMarket = new Ajv().compile(await json("schemas/marketplace.schema.json"));
assert(validateMarket(market), JSON.stringify(validateMarket.errors));
validateCategories(market.categories, market.plugins);
for(const entry of market.plugins) {
 assert(!seen.has(`plugin:${entry.name}`)); seen.add(`plugin:${entry.name}`);
 if(entry.source.source!=="local") { assert(/^[a-f0-9]{40}$/.test(entry.source.sha)); continue; }
 const path=entry.source.path; await local(path);
 const manifest=await json(`${path}/.codex-plugin/plugin.json`);
 assert.equal(manifest.name,entry.name);assert(manifest.version && manifest.author);
 const dir=manifest.skills?.replace(/^\.\//,"");
 if(dir) for(const name of await readdir(resolve(root,path,dir))) await skill(`${path}/${dir}/${name}`);
 assert(!manifest.hooks,"Add explicit Hook validation before publishing a Hook plugin");
}
console.log(`Validated ${market.plugins.length} plugins and ${skills.skills.length} independent skills.`);
