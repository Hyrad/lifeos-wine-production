import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("installs into Home's own scope with correctly sized local icons", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  expect(manifest).toMatchObject({ id: "/lifeos-wine-production/", start_url: "/lifeos-wine-production/", scope: "/lifeos-wine-production/", display: "standalone" });
  for (const icon of manifest.icons) {
    const bytes = readFileSync(`public/${icon.src}`);
    const size = Number(icon.sizes.split("x")[0]);
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
  const html = readFileSync("index.html", "utf8");
  expect(html).toContain('rel="manifest"');
  expect(html).toContain('rel="apple-touch-icon"');
  expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
});
