# Portfolio website

Local dev:

```sh
npm install
npm run dev
```

Build once:

```sh
npm run build
```

GitHub Pages:

- Ensure your default branch is `main`.
- Push to GitHub; the workflow in `.github/workflows/pages.yml` will build and publish.
- In the repo settings → Pages, set Source to GitHub Actions if not already.

Notes:

- The site expects `dist/bundle.js` and `dist/substack.json` to exist. The build script bundles React code and fetches Substack feed.
- Paths are relative for Pages (e.g., `dist/substack.json`), so the site works on both root and user/ org Pages.


