// Thin loader for Payload's Local API so the import scripts can create/update docs
// without an HTTP layer. Requires the scaffolded Payload app (PAYLOAD_APP_DIR) with
// a built/loadable payload.config. Run these scripts from inside that app's context
// (e.g. `cd payload-app && node --experimental-vm-modules ../scripts/05-...`) OR set
// PAYLOAD_CONFIG_PATH so getPayload() can resolve the config.
import path from "node:path";
import { ENV, ROOT } from "./lib.mjs";

let _payload = null;

export async function getPayload() {
  if (_payload) return _payload;
  const appDir = path.resolve(ROOT, ENV.PAYLOAD_APP_DIR || "./payload-app");
  process.env.PAYLOAD_CONFIG_PATH =
    process.env.PAYLOAD_CONFIG_PATH || path.join(appDir, "src", "payload.config.ts");

  let mod;
  try {
    mod = await import("payload"); // resolved from the payload app's node_modules
  } catch (e) {
    throw new Error(
      "Could not import 'payload'. Run these import scripts from the scaffolded " +
      "Payload app context so its node_modules + config resolve. See PLAN.md phase 4.\n" +
      e.message
    );
  }
  const { getPayload: gp } = mod;
  const config = (await import(process.env.PAYLOAD_CONFIG_PATH)).default;
  _payload = await gp({ config });
  return _payload;
}
