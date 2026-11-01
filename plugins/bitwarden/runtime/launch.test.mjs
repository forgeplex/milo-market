import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, chmodSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const launch = fileURLToPath(new URL("./launch.mjs", import.meta.url));
for (const kind of ["shared-directory", "shared-session", "symlink-session"]) {
  test(`rejects ${kind} before starting Bitwarden`, () => {
    const state = mkdtempSync(join(tmpdir(), "milo-bw-test-"));
    try {
      chmodSync(state, kind === "shared-directory" ? 0o755 : 0o700);
      if (kind === "shared-session") writeFileSync(join(state,"session"),"fixture",{mode:0o644});
      if (kind === "symlink-session") {
        writeFileSync(join(state,"target"),"fixture",{mode:0o600});
        symlinkSync(join(state,"target"),join(state,"session"));
      }
      const result=spawnSync(process.execPath,[launch,state],{encoding:"utf8",timeout:5000});
      assert.equal(result.status,1);
      assert.match(result.stderr,/must be.*private/);
      assert.doesNotMatch(result.stderr,/ERR_MODULE_NOT_FOUND/);
    } finally { rmSync(state,{recursive:true,force:true}); }
  });
}
