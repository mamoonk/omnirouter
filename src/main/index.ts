import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { startServer } from './server/index'
import { initDatabase } from './server/db/index'

// Lock userData to a fixed folder so renames don't scatter keys and the DB.
app.setPath('userData', join(app.getPath('appData'), 'omni-router'))

let mainWindow: BrowserWindow | null = null
let cachedPort = 3456

async function createWindow() {
  await initDatabase(join(app.getPath('userData'), 'myrouter.db'))

  const serverPort = await startServer()
  cachedPort = serverPort

  ipcMain.handle('get-server-port', () => cachedPort)
  ipcMain.handle('fs:read-file', (_event, filePath: string) => readFileSync(filePath, 'utf-8'))
  ipcMain.handle('fs:write-file', (_event, filePath: string, content: string) => writeFileSync(filePath, content, 'utf-8'))
  ipcMain.handle('dialog:open-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    },
    show: false
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL || ''
    if (url.startsWith('http') && !url.startsWith(devUrl.replace(/\/$/, ''))) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('server-port', serverPort)
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
