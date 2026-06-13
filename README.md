# ReadForge

ReadForge is a modern Windows EPUB reader project with a polished library, book-cover grid, saved progress, themes, read-aloud controls, and customizable highlighting.

## Included in this build

- Modern Electron + React Windows app
- EPUB import, plus basic TXT/HTML import
- Automatic EPUB title/author/cover extraction
- Library grid view and list view
- Search and sorting
- Saved reading progress per book
- Table of contents/chapter navigation
- Page mode and scrolling mode
- Clean reading mode and original-format mode
- Full-screen reading with auto-hiding controls
- Themes: system/cozy, modern light, cozy library, dark, sepia, midnight, forest, high contrast, custom colors
- Font, font size, margins, line spacing, letter spacing, paragraph spacing, text width, and text alignment controls
- Read-aloud player controls
- Voice selector using Chromium/Windows speech voices
- Speed up to 7x where the voice/browser allows it
- Paragraph and word highlighting while reading aloud
- Multiple read-aloud highlight styles
- Bookmarks
- Paragraph highlights and notes
- Experimental current-chapter WAV export on Windows

## Important voice note

ReadForge uses free voices only. No paid API is included.

The live reader uses Chromium/Electron `speechSynthesis`, which may show more voices than older desktop-only apps. The exact voice list depends on your Windows installation, installed language packs, Narrator voices, and Chromium/Edge voice availability.

Some very natural free voices may require internet even though they are free. Fully offline voices are usually less human-sounding.

## Known limits in this first modern build

- DRM-protected EPUBs are not supported.
- Word highlighting depends on the selected voice providing word-boundary events. If a voice does not support word boundaries, paragraph highlighting still works.
- Chapter WAV export uses Windows desktop speech through PowerShell/System.Speech, so it may have fewer voices than the live reader.
- Very long chapter audio exports may be shortened in this version.
- PDF support is not included yet; EPUB is the priority.
- Original-format mode is experimental. Clean mode is the main reading mode.

## How to run

### One-time setup

1. Install Node.js LTS from the official Node.js website.
2. Extract this ZIP.
3. Double-click:

`1_INSTALL_DEPENDENCIES.bat`

### Start ReadForge

Double-click:

`2_START_READFORGE.bat`

### Build a Windows app / EXE

Double-click:

`3_BUILD_WINDOWS_APP.bat`

When it finishes, look in:

`release`

Electron Builder will create Windows app files there.

## Do you have to install every time?

No.

- Node.js only needs to be installed once.
- Dependencies only need to be installed once for this extracted folder.
- After building, you can use the generated app from the `release` folder.

## Getting more free voices on Windows

Try these:

1. Windows Settings → Accessibility → Narrator → Add natural voices
2. Windows Settings → Time & language → Speech → Manage voices
3. Install extra language packs if needed
4. Restart ReadForge
5. Open a book and click **Refresh voices** in the reading settings panel

## Storage location

ReadForge stores imported books and library data in Electron's user data folder, usually under your Windows AppData folder.


## v1.2 changes

- Added named settings presets per book.
- Added **Save current settings as preset**.
- Added **Load** and **Delete** for saved setting presets.
- Added **Reset layout defaults** for theme/font/spacing/page layout.
- Added **Reset all defaults** for the whole book reading setup.
- Added these preset controls to the normal settings panel and the full-screen settings panel.
- Read-aloud now automatically advances pages in page mode so the visible page follows the paragraph being spoken.


## v1.4 changes

- Fixed table-of-contents clicks so a selected contents item jumps to its actual chapter/section instead of defaulting to the first chapter.
- Improved EPUB TOC path matching, including TOC files stored in different EPUB folders.
- Added support for TOC anchors/fragments when the EPUB points to a section inside a chapter file.
- Added bottom-of-chapter navigation in scrolling mode with **Previous chapter** and **Next chapter** buttons.


## v1.5 changes

- Added **Update Center** to the library screen.
- Added current version display.
- Added update feed URL setting.
- Added release page URL setting.
- Added **Check for updates**.
- Added **Download update**.
- Added **Restart and install downloaded update**.
- Added update event/status messages.
- Added `4_UPDATE_FROM_NEW_ZIP.bat` as a helper reminder.
- Added `UPDATE_NOTES.md`.

Important: automatic updates require the app to be built/installed and require a real update feed URL, such as GitHub Releases or a generic hosted update folder.


## v1.6 changes

- Update Center now supports **GitHub Releases** directly.
- Default GitHub owner/repo is set to `readforge/readforge`.
- Added `GITHUB_UPDATE_FEED_SETUP.md`.
- Added a GitHub Actions release workflow at `.github/workflows/release.yml`.
- Package publishing config is now set for GitHub Releases.

Recommended Update Center values:

- Provider: `GitHub Releases`
- Owner: `readforge`
- Repo: `readforge`
- Release page URL: `https://github.com/readforge/readforge/releases`


## One-time GitHub setup for real app updates

Use `ONE_TIME_SETUP_READFORGE_UPDATES.bat`.

That script will:

- Check/install Git and GitHub CLI through winget if possible
- Sign you into GitHub
- Upload this full ReadForge source to `readforge/readforge`
- Push the release tag `v1.7.0`
- Trigger GitHub Actions to build the Windows release

After the first GitHub release exists, installed ReadForge can check GitHub Releases for updates.
