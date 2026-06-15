import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onServerPort: (callback: (port: number) => void) => {
    ipcRenderer.on('server-port', (_event, port) => callback(port))
  },
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:read-file', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:write-file', filePath, content)
})
