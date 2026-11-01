import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Bitwarden owns its login form; host owns session and profile paths',async()=>{
 const config=JSON.parse(await readFile(new URL('../plugins/bitwarden/configuration.json',import.meta.url)));
 const mcp=JSON.parse(await readFile(new URL('../plugins/bitwarden/.mcp.json',import.meta.url)));
 assert.deepEqual(Object.keys(config.schema.properties),['sessionKey']);
 assert.equal(config.schema.properties.sessionKey.writeOnly,true);
 assert.deepEqual(config.mcp.bitwarden.env,{BW_SESSION:'sessionKey'});
 assert.equal(config.connection.data_env,'BITWARDENCLI_APPDATA_DIR');
 assert.equal(config.connection.secret_field,'sessionKey');
 assert.deepEqual(config.connection.input_schema.required,['serverUrl','email','masterPassword']);
 assert.equal(config.connection.input_schema.properties.masterPassword.writeOnly,true);
 assert.deepEqual(mcp.mcpServers.bitwarden.env,{});
 assert.deepEqual(mcp.mcpServers.bitwarden.enabled_tools,['status','sync','list','get','create_item','edit_item']);
});
