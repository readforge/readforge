# ReadForge GitHub Update Feed Setup

This is the easiest free way to make ReadForge update itself.

## Recommended repo

Use this public GitHub repo:

`readforge/readforge`

That gives you:

Release page URL:

`https://github.com/readforge/readforge/releases`

Update settings inside ReadForge:

- Provider: `GitHub Releases`
- GitHub owner: `readforge`
- GitHub repo: `readforge`

## First-time setup

1. Go to GitHub.
2. Create a new public repository named:

`readforge`

3. Upload the ReadForge project files to that repo.

## Build the app

On your Windows PC:

1. Open the ReadForge project folder.
2. Run:

`1_INSTALL_DEPENDENCIES.bat`

3. Run:

`3_BUILD_WINDOWS_APP.bat`

4. Open the `release` folder.

You should see files like:

- `ReadForge Setup 1.6.0.exe`
- `ReadForge Setup 1.6.0.exe.blockmap`
- `latest.yml`

Those files matter. The updater needs `latest.yml`.

## Create the GitHub release

1. Go to:

`https://github.com/readforge/readforge/releases`

2. Click **Draft a new release**.
3. Tag version:

`v1.6.0`

4. Release title:

`ReadForge v1.6.0`

5. Upload the files from the `release` folder:
   - the `.exe`
   - the `.blockmap`
   - `latest.yml`

6. Publish the release.

## Put this into ReadForge Update Center

Open ReadForge → Update Center.

Use:

- Provider: `GitHub Releases`
- GitHub owner: `readforge`
- GitHub repo: `readforge`
- Release page URL: `https://github.com/readforge/readforge/releases`

Then click:

**Save update settings**

After the next version is published, click:

**Check for updates**

## Important

The installed app must be an older version than the release version to detect an update. For example:

- Installed app: v1.6.0
- GitHub release: v1.7.0

Then ReadForge can detect v1.7.0.
