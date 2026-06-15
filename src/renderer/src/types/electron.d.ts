export interface ElectronAPI {
  onServerPort: (callback: (port: number) => void) => void
  getServerPort: () => Promise<number>
  openFolder: () => Promise<string | null>
  readFile: (filePath: string) => Promise<string>
  writeFile: (filePath: string, content: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
