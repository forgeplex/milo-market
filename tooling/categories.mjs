import assert from "node:assert/strict";
export function validateCategories(categories, plugins) {
 const ids=new Set();
 for(const category of categories){assert(!ids.has(category.id), `Duplicate category: ${category.id}`);ids.add(category.id);}
 for(const plugin of plugins) assert(ids.has(plugin.category), `Unknown category ${plugin.category} for ${plugin.name}`);
}
