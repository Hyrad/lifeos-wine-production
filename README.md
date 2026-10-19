# Wine Production · LifeOS

Independent React/TypeScript/Vite navigation module for personal winemaking.

- **Website:** https://hyrad.github.io/lifeos-wine-production/
- **Repository:** https://github.com/Hyrad/lifeos-wine-production
- **LifeOS Home:** https://hyrad.github.io/lifeos-home/

Wine Production has its own source, package version, tests, GitHub Actions workflow, and GitHub Pages deployment. Ordinary wine-page changes happen entirely in this repository. LifeOS Home links to this published URL; it does not build or import this application. The local styles are a copy of the established LifeOS visual conventions, with no dependency on the Home checkout or a shared package.

**Durable website checkpoint:** use an authorized Life Command Center connection to find the Notes & Memory record titled **Wine Production website — implementation and release checkpoint**. Its private URL is kept out of public source.

## Navigation edition

Eight sections cover active batches, batch history, the reusable Recipe Library, approval review, shared Tasks, batch-management guide, Wine Production Drive folder, and Wine Making Area notes. Active and history routes open the canonical register; choose the named view there. Recipe and approval routes open the existing approved Wine Making Area entry point, which now contains the library and linked review/approved views. Draft, Testing, Approved and Archived describe recipes; production stages continue to describe physical batches. Existing Notion and Drive permissions remain authoritative. The site does not read private data, show live batch state or approval counts, or save production changes.

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

Open `/lifeos-wine-production/`. The app version is read from `package.json`; update it for a release. Versions evolve independently from LifeOS Home. Push `main` to test, build, and deploy only this site. Pull requests test/build without deployment. No repository secret is required; the workflow uses the generated GitHub token.

For browser checks against a running production preview:

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

`BROWSER_CHANNEL=chrome` uses an installed Chrome. `CHECK_URL` can point to the deployed wine site. Checks cover four widths, version display, anchors and direct reload, keyboard entry, automated WCAG A/AA rules, and unexpected network requests. Screenshots go to ignored `test-results/`. Automated checks complement visual review.

## Extraction history

The initial design was extracted from LifeOS Home v1.1.0, source commit `ccfb223feaba2bad211360bb3d77f8ad5747d82d`. The standalone module starts at v1.0.0. No personal data migration occurred. Home's former `/lifeos-home/wine/` location is retained there as a compatibility redirect after this site is verified.

The Notion-to-Markdown memory refactor remains deferred.
