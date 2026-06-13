# ReadForge Updates

## What v1.5 adds

ReadForge now includes an **Update Center** on the library screen.

It includes:

- Current app version display
- Update feed URL setting
- Release page URL setting
- Check for updates
- Download update
- Restart and install downloaded update
- Progress/status messages

## Important first-time setup

The updater can only fully work after ReadForge is built/installed from the `release` folder.

During development mode (`npm run dev`), the update screen will exist, but it cannot install updates into the development folder.

## What is still needed for true one-click updates?

A stable release/update URL.

Best option:

- GitHub Releases
- Electron Builder publish metadata
- ReadForge's Update Center pointed at the update feed

Once that exists, you should not need to manually reinstall every small fix.
