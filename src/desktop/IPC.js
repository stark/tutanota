// @flow
import {ipcMain} from 'electron'
import {MainWindow} from './MainWindow'

export default class IPC {

	static _send = () => console.log("ipc not initialized!")
	static _on = () => console.log("ipc not initialized!")
	static _once = () => console.log("ipc not initialized!")

	static init(window: MainWindow) {
		IPC._send = (...args: any) => window._browserWindow.webContents.send.apply(window._browserWindow.webContents, args)
		IPC._on = (...args: any) => ipcMain.on.apply(ipcMain, args)
		IPC._once = (...args: any) => ipcMain.once.apply(ipcMain, args)

		ipcMain.on('show-window', () => {
			window.show()
		})
	}

	static send(...args: any) {
		return IPC._send.apply(this, args)
	}

	static on(...args: any) {
		return IPC._on.apply(this, args)
	}

	static once(...args: any) {
		return IPC._on.apply(this, args)
	}
}