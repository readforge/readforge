# Voice Troubleshooting for ReadForge

## Why David and Zira happen

David and Zira are older Windows desktop voices. Apps that use only the old SAPI system often see only those voices.

ReadForge's live reader uses Chromium/Electron speech synthesis, which can often see more Windows/browser voices.

## How to get more free voices

1. Open Windows Settings.
2. Go to Accessibility.
3. Open Narrator.
4. Install available natural voices.
5. Also check Time & language → Speech → Manage voices.
6. Restart ReadForge.
7. Open a book.
8. Click Refresh voices in the reading settings panel.

## Important limitation

Some natural free voices are online/cloud voices. They may require internet even though they are free. Offline voices are usually less human-sounding.

## Audio export limitation

The current chapter WAV export uses older Windows desktop speech. The live reader may have more voices than the WAV exporter.


## Microsoft Andrew Natural HD

To try Microsoft Andrew Natural HD in ReadForge:

1. Open **Windows Settings**.
2. Go to **Accessibility → Narrator**.
3. Under natural voices, install **Microsoft Andrew Natural HD** if it is available.
4. Restart ReadForge.
5. Open a book.
6. In Reading settings, set **Voice engine** to **Windows Natural voices - Andrew HD**.
7. Click **Refresh Windows Natural voices**.
8. Choose **Andrew** from the Windows voice list.

If Andrew does not appear, Windows may not be exposing that voice to third-party apps on your PC. ReadForge can only use it if Windows exposes it through the Windows.Media.SpeechSynthesis voice list.
