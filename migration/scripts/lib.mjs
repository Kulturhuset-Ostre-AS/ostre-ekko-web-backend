// Shared helpers for the Craft -> Payload migration scripts.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = path.join(ROOT, "data");

export function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  const out = { ...process.env };
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (out[k] === undefined) out[k] = v;
    }
  }
  return out;
}

export const ENV = loadEnv();
export const LOCALES = (ENV.LOCALES || "en,nb").split(",").map((s) => s.trim());

export function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function writeJSON(name, obj) {
  ensureDataDir();
  const p = path.join(DATA_DIR, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

export function readJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

/** POST a GraphQL query to Craft. Throws on transport or GraphQL errors. */
export async function gql(query, variables = {}, { locale } = {}) {
  const url = ENV.CRAFT_GRAPHQL_URL;
  if (!url) throw new Error("CRAFT_GRAPHQL_URL not set (see migration/.env)");
  const headers = { "Content-Type": "application/json" };
  if (ENV.CRAFT_GRAPHQL_TOKEN) headers.Authorization = `Bearer ${ENV.CRAFT_GRAPHQL_TOKEN}`;
  // Craft accepts the site via the X-Craft-Site header or a ?site= query arg.
  const reqUrl = locale ? `${url}${url.includes("?") ? "&" : "?"}site=${encodeURIComponent(locale)}` : url;

  const res = await fetch(reqUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error("GraphQL errors:\n" + json.errors.map((e) => `  - ${e.message}`).join("\n"));
  }
  return json.data;
}

export const camel = (s) => s.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""));
export const log = (...a) => console.log(...a);
export const warn = (...a) => console.warn("⚠ ", ...a);
