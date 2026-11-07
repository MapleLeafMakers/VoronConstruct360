# Voron Construct Fusion 360 Add-In

A Fusion 360 add-in for browsing and importing CAD from GitHub repositories. Fork of [MapleLeafMakers/VoronConstruct360](https://github.com/MapleLeafMakers/VoronConstruct360).

## What's different in this fork

- **Auto-Thumb fixes.** Failures are now logged to Fusion's Text Commands window instead of being silently swallowed. The viewport is refreshed and fitted before the screenshot is taken, failed downloads are detected, and the dialog warns when no thumbnails were generated. The "Upload To" repository is also pre-selected so the OK button isn't stuck disabled.
- **Auto-F3D (new).** Generates and uploads `.f3d` files for library items that only have a STEP/STP file.
- **Local UI server.** If a built UI is bundled in the add-in's `ui/` folder, the add-in serves it from a small local HTTP server on `127.0.0.1` (random free port), so no separate web server is needed.
- **Fork-hosted UI.** The default UI address points at this fork's GitHub Pages site, deployed automatically from `main` by `.github/workflows/pages.yml`.
- **Windows build fixes.** `package.json` now allows the install scripts for `vue-demi` and `esbuild`. The log helper's config import was also corrected.

## Installation

Releases from the upstream project do not include the changes above, so install this fork from source.

### Build from source

Requirements: Python 3, and Node.js 18, 20 or 22 (newer versions may build but are not officially supported by the Quasar tooling used here).

```sh
git clone https://github.com/crashingtardis/VoronConstruct360
cd VoronConstruct360
pip install -r plugin/requirements.txt --no-user --ignore-installed --target=plugin/lib
npm install
npm run build:fusion
```

`npm run build:fusion` builds the UI and copies everything into your Fusion 360 Add-Ins folder as `Construct`:

- Windows: `%appdata%\Autodesk\Autodesk Fusion 360\API\AddIns\Construct`
- macOS: `~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns/Construct`

Set the `FUSION_ADDINS_DIR` environment variable first if your Add-Ins folder is somewhere else.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the UI to `dist/spa` |
| `npm run deploy:fusion` | Copies the plugin (and `dist/spa`, if present) into the Add-Ins folder without rebuilding |
| `npm run build:installer` | Builds the Windows installer via `scripts/build_installer.ps1` |
| `npm run dev` | Runs the UI in a browser for development (Fusion-only features won't work) |

After deploying, restart the add-in: **Utilities → Add-Ins → Scripts and Add-Ins**, stop **Construct**, then run it again. Python changes only take effect after a restart.

### Where the UI is loaded from

On startup the add-in picks the UI address in this order:

1. The `interfaceUrl` preference, if set.
2. A local build at `Construct/ui/index.html`, served from the add-in's own local HTTP server.
3. `PALETTE_URL` in `plugin/commands/showConstruct/entry.py` (this fork's GitHub Pages site by default).

`npm run deploy:fusion` copies `dist/spa` into `Construct/ui`, so a build from source uses option 2. Delete that `ui` folder if you want to use the hosted UI instead.

### Hosting the UI on your own fork (optional)

1. Push to `main` with `.github/workflows/pages.yml` included.
2. In the fork, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Set `PALETTE_URL` in `plugin/commands/showConstruct/entry.py` to `https://<your-username>.github.io/VoronConstruct360/`.

## Usage

- A new entry is added under the **Insert** menu on the SOLIDS panel.
- Click the gear icon to enter your GitHub personal access token.

  How to generate a token:

  1. Make sure you're logged into GitHub, go to [Settings → Developer settings](https://github.com/settings/apps), then **Personal access tokens**, and choose the token type (classic is fine).
  2. Click **Generate new token** and choose the token usage.
  3. Enter a note describing what the token is for, select an expiry time, select a scope (none are needed for public repositories) and click **Generate token**.
  4. Copy the token and paste it into the token field in the gear menu. To read private repositories or upload files, the token needs the appropriate repository access.

- Enter a repository in `<owner>/<repo>` format (e.g. `kyleisah/Voron-Construct`) and click **Load**.

Now, you have CAD. Lots of CAD.

## Library management tools

These tools are hidden by default. Open the gear menu and tick **Mgmt. Controls** to show them in the menu.

### Auto-Thumb

Generates a `.png` thumbnail for every STEP/F3D model in the selected path that doesn't already have one.

1. Choose a collection and select a path in the tree (select `/` for the whole collection).
2. Click **OK**. Each model is imported into a temporary Fusion document, framed, captured and closed.
3. Choose the repository to upload to and click **OK** again to commit the thumbnails.

Thumbnails are stored next to the model with the same name and a `.png` extension.

### Auto-F3D

Generates a `.f3d` file for every STEP/STP model in the selected path that has no `.f3d` yet. Existing `.f3d` files are never replaced. It works like Auto-Thumb: pick a collection and path, generate, then upload.

## Troubleshooting

- **Auto-Thumb or Auto-F3D does nothing:** open **View → Show Text Commands** (`Ctrl+Alt+C` on Windows, `Cmd+Option+C` on macOS) and watch the **Text** tab while it runs. Failures are logged there with a full traceback.
- **Menu items are missing:** tick **Mgmt. Controls** in the gear menu.
- **Downloads fail on private repositories:** check that your token has access to the repository.
- **UI changes don't appear:** rebuild and redeploy, and close and reopen the palette. If an `interfaceUrl` preference is set, it overrides the local and hosted UI.
- **Python changes don't appear:** restart the add-in from **Scripts and Add-Ins**.
- **Build errors on a very new Node version:** switch to Node 20 or 22 (for example with [nvm-windows](https://github.com/coreybutler/nvm-windows)) and run `npm install` again.
