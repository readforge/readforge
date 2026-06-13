# How to finish ReadForge auto-updates

This is the one-time setup that makes future ReadForge updates work through **Check for Updates**.

## What you do once

1. Extract this ZIP.
2. Double-click:

`ONE_TIME_SETUP_READFORGE_UPDATES.bat`

If GitHub login gives trouble, double-click `LOGIN_TO_GITHUB_FIRST.bat`, sign in, then run `ONE_TIME_SETUP_READFORGE_UPDATES.bat` again.

3. Sign into GitHub if it asks.
4. Wait for it to push the source and tag `v1.7.0`.
5. Open:

`https://github.com/readforge/readforge/actions`

6. Wait for the workflow to finish.
7. Open:

`https://github.com/readforge/readforge/releases`

8. Confirm release `v1.7.0` exists and contains files like:
   - `ReadForge Setup 1.7.0.exe`
   - `.blockmap`
   - `latest.yml`

## Then install this version once

Install the generated `ReadForge Setup 1.7.0.exe` from GitHub Releases.

After that, future updates should be able to work like this:

1. You tell ChatGPT what to fix.
2. ChatGPT updates the GitHub repo.
3. A new release is created.
4. You open ReadForge.
5. Press **Check for updates**.
6. ReadForge updates itself.

## Why this one-time setup is needed

The app cannot update unless GitHub has the release files. This script creates the pipeline that makes GitHub build those files automatically.


## Fixed 2 note

This version fixes the first-time Git remote setup so a brand-new folder without `origin` does not crash.


## Fixed 3 note

This version force-replaces the partial GitHub repo contents. This is expected because the repo only had partial setup files. Use this version if `package.json` did not appear on GitHub after running the earlier setup.
