const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('readforge', {
  getLibrary: () => ipcRenderer.invoke('library:get'),
  saveLibrary: (library) => ipcRenderer.invoke('library:save', library),
  importBook: () => ipcRenderer.invoke('book:import'),
  readBook: (bookId) => ipcRenderer.invoke('book:read', bookId),
  revealUserData: () => ipcRenderer.invoke('app:revealUserData'),
  exportChapterAudio: (payload) => ipcRenderer.invoke('audio:exportChapterWav', payload),
  listWindowsNaturalVoices: () => ipcRenderer.invoke('winrt:listVoices'),
  synthesizeWindowsNaturalSpeech: (payload) => ipcRenderer.invoke('winrt:synthesizeSpeech', payload),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  checkForUpdates: (payload) => ipcRenderer.invoke('updater:checkForUpdates', payload),
  downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
  installUpdate: () => ipcRenderer.invoke('updater:installUpdate'),
  onUpdateEvent: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('updater:event', handler)
    return () => ipcRenderer.removeListener('updater:event', handler)
  },
  platform: process.platform
})
