<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:desktop-release-rules -->
# Desktop app releases — MANDATORY procedure

BogglTrack ships as a Next.js web app AND a macOS Electron desktop app. The desktop app self-updates via `electron-updater` reading GitHub Releases. **Shipping a web change alone is NOT enough if it should reach desktop users — you must also cut a desktop release.**

## When a desktop release is REQUIRED (not optional)

Cut a new `desktop-vX.Y.Z` release whenever ANY of these change in ways desktop users would see:
- UI, styling, or any component under `src/` (the desktop app loads the hosted web URL, so most UI changes ship via Vercel automatically — **BUT** if the change affects the Electron shell or the hosted URL, release). When in doubt, ask.
- Anything inside `electron/` (main.js, preload.js, menu, tray, window behavior, IPC channels).
- `electron-builder.yml` config.
- `package.json` `main`, `version`, or dependencies used by the Electron shell (`electron-updater`, `electron`, etc.).
- The production URL the shell loads (`BOGGLTRACK_URL` / `PROD_URL` default).
- The app icon, DMG background, or entitlements.

## The 4-step release procedure — DO NOT SKIP STEPS

Execute these in order. Every step. No shortcuts.

```bash
# 1. Bump the version in BOTH places:
#    - package.json  "version": "X.Y.Z"
#    - src/app/page.tsx  DMG_URL filename (BogglTrack-X.Y.Z-arm64.dmg)
#    These MUST match or the landing page's Download button 404s.

# 2. Rebuild the DMG from a clean dist/
rm -rf dist && npm run dmg

# 3. Create the GitHub Release with all three assets.
#    latest-mac.yml is required — that's what running apps read to detect updates.
gh release create desktop-vX.Y.Z \
  dist/BogglTrack-X.Y.Z-arm64.dmg \
  dist/BogglTrack-X.Y.Z-arm64.dmg.blockmap \
  dist/latest-mac.yml \
  --title "BogglTrack X.Y.Z" \
  --notes "<changelog>"

# 4. Commit the version bumps and push so Vercel rebuilds the landing page
#    with the new DMG_URL.
git add package.json package-lock.json src/app/page.tsx
git commit -m "chore(desktop): release vX.Y.Z"
git push origin main
```

## Hard rules — these are not suggestions

1. **NEVER release a DMG without also pushing the matching `DMG_URL` bump in `src/app/page.tsx`.** The landing page download button will 404 if filenames drift.
2. **NEVER skip uploading `latest-mac.yml` to the GitHub Release.** Without it, `electron-updater` in every installed v0.2.0+ app fails silently — users stay on the old version forever.
3. **NEVER skip the `.dmg.blockmap` file.** `electron-updater` uses it for delta updates; missing it forces users to re-download the full DMG every time.
4. **NEVER commit `dist/` or the DMG itself.** They're in `.gitignore` for a reason — GitHub Releases hosts the binary, git does not.
5. **Release tag format is `desktop-vX.Y.Z` exactly** (three parts, lowercase `v`). Do not invent alternatives — the CI workflow matches this prefix and electron-updater's GitHub provider expects it.
6. **Version in `package.json` == version in release tag == version in DMG filename.** Any mismatch between these breaks update detection.

## If you see `identity: null` in electron-builder.yml
That means the build is unsigned. **Don't touch it** unless the user has set up an Apple Developer account and provided signing certs. Without certs, turning on signing breaks the build. Users on unsigned v0.x will see a Gatekeeper warning on first open — documented in the release notes as expected.

## Verification after every release

Run these three checks. All must pass:

```bash
# a) Landing page download URL returns a real asset (not 404)
curl -sLI https://github.com/burhankhatri/BogglTrack/releases/latest/download/BogglTrack-<VERSION>-arm64.dmg | head -1
# expect: HTTP/2 302 (follows to the CDN which returns 200)

# b) latest-mac.yml is public on the release
curl -s https://github.com/burhankhatri/BogglTrack/releases/download/desktop-v<VERSION>/latest-mac.yml | grep "^version:"
# expect: version: <VERSION>

# c) Landing page on Vercel is serving the new version string in DMG_URL
curl -s https://boggl-track.vercel.app/ | grep -oE "BogglTrack-[0-9.]+-arm64\.dmg" | sort -u
# expect: BogglTrack-<VERSION>-arm64.dmg
```

If any of these fail, the release is broken and users will hit a dead link. Roll the version forward and fix before walking away.
<!-- END:desktop-release-rules -->
