import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Bitwarden form exposes only the private unlock key; runtime owns paths',async()=>{
 const config=JSON.parse(await readFile(new URL('../plugins/bitwarden/configuration.json',import.meta.url)));
 const mcp=JSON.parse(await readFile(new URL('../plugins/bitwarden/.mcp.json',import.meta.url)));
 assert.deepEqual(Object.keys(config.schema.properties),['sessionKey']);
 assert.equal(config.schema.properties.sessionKey.writeOnly,true);
 assert.deepEqual(config.mcp.bitwarden.env,{BW_SESSION:'sessionKey'});
 assert.ok(mcp.mcpServers.bitwarden.env.BITWARDENCLI_APPDATA_DIR.startsWith('/'));
});
