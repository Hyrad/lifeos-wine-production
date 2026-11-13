# Wine Production · LifeOS

Independent React/TypeScript/Vite navigation module for personal winemaking.

- **Website:** https://hyrad.github.io/lifeos-wine-production/
- **Repository:** https://github.com/Hyrad/lifeos-wine-production
- **LifeOS Home:** https://hyrad.github.io/lifeos-home/

Wine Production has its own source, package version, tests, GitHub Actions workflow, and GitHub Pages deployment. Ordinary wine-page changes happen entirely in this repository. LifeOS Home links to this published URL; it does not build or import this application. The local styles are a copy of the established LifeOS visual conventions, with no dependency on the Home checkout or a shared package.

**Durable website checkpoint:** use an authorized Life Command Center connection to find the Notes & Memory record titled **Wine Production website — implementation and release checkpoint**. Its private URL is kept out of public source.

## Navigation edition

The first dashboard row separates **Planned Batches**, **Active Batches** and **Production History**. Plans have not started; active batches are undergoing fermentation/processing; history contains bottled, completed and abandoned production. All three open the existing canonical register; choose **Planned batches**, **Active batches** or **Batch history** there. No new view URLs or private record destinations are published.

The second row starts with a highlighted **Recipe Library**, followed by Approval Status and Production Actions. Methods & Guides, Photos & Documents, and Ideas & Experiments remain below. On iPad portrait the recipe card spans the resource grid; on iPhone the cards stack in the same order. Sidebar navigation and the section shortcuts retain all eight original anchors, including `#batches` and `#archive`; `#planned` is the only added anchor. The old Batch History label is now Production History.

Recipe and approval routes open the existing approved Wine Making Area entry point. Draft, Testing, Approved and Archived describe recipes; production stages describe physical batches. Existing Notion and Drive permissions remain authoritative. This release remains navigation-first: it does not fetch private data, show batch/approval counts, synchronize records, browse recipes, create batch-to-recipe relationships, or save production changes.

The three additional entry-point URLs (wine register, guide, Drive folder) were explicitly approved for public source on 2026-10-18. Individual batch, inventory, dated task, private media, postmortem and exploratory-idea deep links are excluded. No personal production records, measurements, original photographs, credentials or unauthenticated private integrations belong in this public repository.

Canonical ownership remains in [Wine Making](https://app.notion.com/p/472be780ce1a8247b9ed8166a00fb5ad), with records in [Registre de vinification](https://app.notion.com/p/5a4be780ce1a82b1a032819846b76317), and workflow in [Wine Batch Management](https://app.notion.com/p/3a2be780ce1a812d8785f5d971da276e). The [Life Command Center](https://app.notion.com/p/3afbe780ce1a83b883d18111ca195c69) remains the governance root. Keep personal, business and employment systems separate.

## Development and releases

Use Node.js 24 (minimum 22.13) and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm preview --port 4174
```

Open `/lifeos-wine-production/`. The requested user-facing release **v1.201** is stored as `displayVersion` in `package.json`; its package-manager-compatible SemVer is **1.201.0**. All three UI labels use that package metadata, and a test keeps the two values consistent. Versions evolve independently from LifeOS Home.

For this implementation candidate, merge and deployment require Hyrad's separate approval. A push to `main` automatically tests, builds and deploys this site; do not merge or push `main` until deployment is also authorized. Pull requests test/build without deployment. No repository secret is required; the workflow uses the generated GitHub token.

For browser checks against a running production preview:

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

`BROWSER_CHANNEL=chrome` uses an installed Chrome. `CHECK_URL` can point to a matching preview or deployed release. Candidate browser checks expect v1.201, so they should not be run against production until that version is approved and deployed. Checks cover desktop, iPad portrait/landscape and iPhone sizes; the three primary cards in order and within the desktop viewport; Recipe Library placement; all nine anchors and direct reload; keyboard use; 44 px link targets; automated WCAG A/AA rules; manifest/Apple assets; and unexpected requests. Canonical outbound links are verified with intercepted responses, without accessing private records. Screenshots go to ignored `test-results/`; `SCREENSHOT_DIR` can select a separate evidence directory. Physical Home Screen installation remains a device acceptance check.

`pnpm build` includes the public artifact boundary scan (`pnpm test:boundary`). It rejects destinations outside the shipped v1.2.0 allowlist, new private identifiers/hosts, credential patterns, inline executable content, external assets and source maps. No private production or recipe fixtures belong in tests or public documentation.

## Extraction history

The initial design was extracted from LifeOS Home v1.1.0, source commit `ccfb223feaba2bad211360bb3d77f8ad5747d82d`. The standalone module starts at v1.0.0. No personal data migration occurred. Home's former `/lifeos-home/wine/` location is retained there as a compatibility redirect after this site is verified.

The Notion-to-Markdown memory refactor remains deferred.

## iPhone Home Screen app

Open the deployed application in Safari → Share → Add to Home Screen → enable Open as Web App → Add. The manifest, Apple touch icon and standalone safe-area styling support a separate app icon/window. Physical iPhone installation remains a device acceptance check. No service worker, offline caching or push notifications are included.
