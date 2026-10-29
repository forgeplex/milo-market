import test from "node:test";
import assert from "node:assert/strict";
import { validateCategories } from "./categories.mjs";
test("category references reject typos and duplicate IDs",()=>{
 const categories=[{id:"productivity"}];
 assert.doesNotThrow(()=>validateCategories(categories,[{name:"check",category:"productivity"}]));
 assert.throws(()=>validateCategories(categories,[{name:"check",category:"typo"}]),/Unknown category/);
 assert.throws(()=>validateCategories([...categories,...categories],[]),/Duplicate category/);
});
