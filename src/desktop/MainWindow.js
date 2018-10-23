// @flow
import IPC from './IPC.js'
import type {ElectronPermission} from 'electron'
import {BrowserWindow, WebContents} from 'electron'
import * as localShortcut from 'electron-localshortcut'
import open from './open.js'
import DesktopUtils from './DesktopUtils.js'
import path from 'path'

export class MainWindow {
	_rewroteURL: boolean;
	_startFile: string;
	_browserWindow: BrowserWindow;

	constructor() {
		this._rewroteURL = false
		let normalizedPath = path.join(__dirname, "..", "..", "desktop.html")
		this._startFile = DesktopUtils.pathToFileURL(normalizedPath)
		console.log("startFile: ", this._startFile)
		this._browserWindow = new BrowserWindow({
			width: 1280,
			height: 800,
			autoHideMenuBar: true,
			webPreferences: {
				nodeIntegration: false,
				nodeIntegrationInWorker: false,
				// TODO: not a real os sandbox yet.
				// https://github.com/electron-userland/electron-builder/issues/2562
				// https://electronjs.org/docs/api/sandbox-option
				sandbox: true,
				// can't use contextIsolation because this will isolate
				// the preload script from the web app
				// contextIsolation: true,
				webSecurity: true,
				preload: path.join(__dirname, 'preload.js')
			}
		})

		IPC.init(this._browserWindow)

		// user clicked 'x' button
		this._browserWindow
		    .on('close', () => {
			    IPC.send('close-editor')
		    })

		this._browserWindow.webContents.session.setPermissionRequestHandler(this._permissionRequestHandler)

		this._browserWindow.webContents
		    .on('new-window', (e, url) => {
			    // we never open any new windows except for links in mails etc.
			    // so open them in the browser, not in electron
			    open(url)
			    e.preventDefault()
		    })
		    .on('will-attach-webview', (e: Event, webPreferences, params) => {
			    // should never be called, but if somehow a webview gets created
			    // we kill it
			    e.preventDefault()
		    })
		    .on('did-start-navigation', (e, url, isInPlace) => {
			    const newURL = this._rewriteURL(url, isInPlace)
			    if (newURL !== url) {
				    e.preventDefault()
				    this._browserWindow.loadURL(newURL)
			    }
		    })

		localShortcut.register('F12', () => this._toggleDevTools())
		localShortcut.register('F5', () => this._browserWindow.loadURL(this._startFile))

		this._loadMailtoPath(process.argv.find((arg) => arg.startsWith('mailto')))
	}

	show(mailtoArg: ?string) {
		if (this._browserWindow.isMinimized()) {
			this._browserWindow.restore()
			this._browserWindow.show()
		} else {
			this._browserWindow.focus()
		}
		if (mailtoArg) {
			IPC.send('close-editor')
			this._loadMailtoPath(mailtoArg)
		}
	}

	// filesystem paths work differently than URLs
	_rewriteURL(url: string, isInPlace: boolean): string {
		if (!url.startsWith(this._startFile)) {
			return this._startFile
		}
		if (url === this._startFile + '/login?noAutoLogin=true' && isInPlace) {
			if (!this._rewroteURL) {
				this._rewroteURL = true
				return this._startFile + '?noAutoLogin=true'
			} else {
				this._rewroteURL = false
			}
		}
		return url
	}

	_permissionRequestHandler(webContents: WebContents, permission: ElectronPermission, callback: (boolean) => void) {
		const url = webContents.getURL()
		if (!url.startsWith('https://mail.tutanota.com') || !(permission === 'notifications')) {
			return callback(false)
		}
		return callback(true)
	}

	_loadMailtoPath(mailtoArg: ?string): void {
		const mailtoPath = (mailtoArg)
			? "?requestedPath=%2Fmailto%23url%3D" + encodeURIComponent(mailtoArg)
			: ""
		this._browserWindow.loadURL(`${this._startFile}${mailtoPath}`)
	}

	_toggleDevTools(): void {
		const wc = this._browserWindow.webContents
		if (wc.isDevToolsOpened()) {
			wc.closeDevTools()
		} else {
			wc.openDevTools({mode: 'undocked'})
		}
	}

	_refresh(): void {
		this._browserWindow.webContents.reloadIgnoringCache()
	}
}