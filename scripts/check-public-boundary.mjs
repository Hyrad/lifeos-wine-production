import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

// This allowlist is the shipped v1.2.0 publication boundary, not a list of
// discovered personal records. Adding destinations requires separate approval.
const approved = new Set([
  "https://hyrad.github.io/lifeos-home/",
  "https://app.notion.com/p/3afbe780ce1a83b883d18111ca195c69",
  "https://app.notion.com/p/3f1be780ce1a81ccbd9ce0331175706f",
  "https://app.notion.com/p/5a5be780ce1a83409023815e44656150",
  "https://app.notion.com/p/472be780ce1a8247b9ed8166a00fb5ad",
  "https://app.notion.com/p/5a4be780ce1a82b1a032819846b76317",
  "https://app.notion.com/p/3a2be780ce1a812d8785f5d971da276e",
  "https://drive.google.com/drive/folders/1tyjh5dS6DLKhm1A3bweBlqqgUn0p_pJV",
]);
const standards = new Set([
  "https://react.dev/errors/",
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/XML/1998/namespace",
]);
const found = new Set();
let scanned = 0;
assert.deepEqual((await readdir("dist")).sort(), ["assets", "favicon.svg", "icons", "index.html", "manifest.webmanifest"]);
const assets = await readdir("dist/assets");
assert.equal(assets.length, 2);
for (const name of assets) assert.match(name, /^[\w-]+\.(js|css)$/);
for (const path of ["index.html", "manifest.webmanifest", "favicon.svg", ...assets.map(n => `assets/${n}`)]) {
  const content = await readFile(`dist/${path}`, "utf8");
  scanned++;
  assert.doesNotMatch(content, /(?:ntn_|secret_|sb_secret_|ghp_|github_pat_|sk_live_)[A-Za-z0-9_]{8,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/, `Credential pattern in ${path}`);
  const withoutURLs = content.replace(/https?:\/\/[^\s"'<>\x60\\)]+/g, url => {
    // The existing notion(id) helper remains a template in Vite's bundle.
    // Its literal IDs are checked against the same fixed allowlist below.
    const notionTemplate = /^https:\/\/app\.notion\.com\/p\/\$\{[\w$]+\}$/.test(url);
    assert.ok(approved.has(url) || standards.has(url) || notionTemplate, `Unapproved URL in ${path}: ${url}`);
    if (approved.has(url)) found.add(url);
    return "";
  });
  const remaining = withoutURLs.replace(/\b[a-f0-9]{32}\b/g, id => {
    const destination = `https://app.notion.com/p/${id}`;
    assert.ok(approved.has(destination), `Unapproved Notion identifier in ${path}`);
    found.add(destination);
    return "";
  });
  assert.doesNotMatch(remaining, /\b[a-f0-9]{32}\b|\b[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b|\.ts\.net\b|\/(?:home|Users|workspace)\/|\b(?:127\.0\.0\.1|100\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)\b/i, `Unapproved private reference in ${path}`);
  if (path === "index.html") {
    assert.match(content, /Content-Security-Policy/);
    assert.match(content, /connect-src (?:'|&#39;)self(?:'|&#39;);/);
    assert.doesNotMatch(content, /<script(?![^>]*\bsrc=)[^>]*>|<style\b|\sstyle=/i);
    assert.doesNotMatch(content, /(?:src|href)="(?:https?:)?\/\//i);
  }
}
assert.deepEqual([...found].sort(), [...approved].sort());
assert.deepEqual((await readdir("dist/icons")).sort(), ["apple-touch-icon.png", "icon-192.png", "icon-512.png"]);
console.log(`Public boundary PASS: ${scanned} text artifacts; only the 8 shipped destinations; no new private identifiers, hosts, credential patterns, source maps or external assets.`);
