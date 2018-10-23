// @flow
import * as url from 'url'
import path from 'path'
import {exec, spawn} from 'child_process'
import fs from "fs-extra"
import crypto from 'crypto'
import Promise from 'bluebird'
import {app} from 'electron'
import {defer} from '../api/common/utils/Utils.js'

export default class DesktopUtils {

	/**
	 *
	 * @param pathToConvert absolute Path to a file
	 * @returns {string} file:// URL that can be extended with query parameters and loaded with BrowserWindow.loadURL()
	 */
	static pathToFileURL(pathToConvert: string): string {
		pathToConvert = pathToConvert
			.trim()
			.split(path.sep)
			.map((fragment) => encodeURIComponent(fragment))
			.join("/")
		const extraSlashForWindows = process.platform === "win32"
			? "/"
			: ""
		let urlFromPath = url.format({
			pathname: extraSlashForWindows + pathToConvert.trim(),
			protocol: 'file:'
		})

		return urlFromPath.trim()
	}

	/**
	 * Checks if the user has admin privileges on Windows
	 * @returns {boolean} true if user has admin privileges
	 */
	static isUserAdmin(): boolean {
		let isAdmin = false
		exec('NET SESSION', (err, so, se) => {
			isAdmin = (se.length === 0)
			console.log(se.length === 0 ? "admin" : "not admin");
		})
		return isAdmin
	}

	static registerAsMailtoHandler(tryToElevate: boolean): Promise<void> {
		switch (process.platform) {
			case "win32":
				if (!DesktopUtils.isUserAdmin() && tryToElevate) {
					return DesktopUtils._elevateWin(process.execPath, ["-r"])
				} else {
					return DesktopUtils.registerOnWin()
				}
			case "darwin":
				return Promise.resolve()
			case "linux":
				return Promise.resolve()
		}
	}

	static unregisterAsMailtoHandler(tryToElevate: boolean): Promise<void> {
		switch (process.platform) {
			case "win32":
				if (!DesktopUtils.isUserAdmin() && tryToElevate) {
					return DesktopUtils._elevateWin(process.execPath, ["-u"])
				} else {
					return DesktopUtils.unregisterOnWin()
				}
			case "darwin":
				return Promise.resolve()
			case "linux":
				return Promise.resolve()
		}
	}

	static _elevateWin(command: string, args: [string]) {
		const deferred = defer()
		const templatedVbs = `Set Shell = CreateObject("Shell.Application")
Shell.ShellExecute "${command}", "${args.join(" ")}", "", "runas", 0
`.replace(/\n/g, "\r\n")
		const file = DesktopUtils._writeToDisk(templatedVbs, "vbs")
		spawn("wscript.exe", [file], {
			stdio: ['ignore', 'inherit', 'inherit'],
			detached: false
		}).on('exit', (code, signal) => {
			fs.unlinkSync(file)
			if (code === 0) {
				deferred.resolve()
			} else {
				deferred.reject(new Error("couldn't elevate permissions"))
			}
		})
		return deferred.promise
	}

	static registerOnWin(): Promise<void> {
		const tmpRegScript = require('./reg-templater.js').registerKeys(process.execPath)
		return DesktopUtils._executeRegistryScript(tmpRegScript)
		                   .then(() => app.setAsDefaultProtocolClient('mailto'))
	}

	static unregisterOnWin(): Promise<void> {
		app.removeAsDefaultProtocolClient('mailto')
		const tmpRegScript = require('./reg-templater.js').unregisterKeys()
		return DesktopUtils._executeRegistryScript(tmpRegScript)
	}

	/**
	 * this will silently fail if we're not admin.
	 * @param script: path to registry script
	 * @private
	 */
	static _executeRegistryScript(script: string): Promise<void> {
		const deferred = defer()
		const file = DesktopUtils._writeToDisk(script, "reg")
		spawn('reg.exe', ['import', file], {
			stdio: ['ignore', 'inherit', 'inherit'],
			detached: false
		}).on('exit', (code, signal) => {
			fs.unlinkSync(file)
			if (code === 0) {
				deferred.resolve()
			} else {
				deferred.reject(new Error("couldn't execute registry script"))
			}
		})
		return deferred.promise
	}

	static _writeToDisk(contents: string, extension: string): string {

		const filename = crypto.randomBytes(12).toString('hex') + "." + extension
		console.log("Wrote file to ", filename)
		const filePath = path.join(path.dirname(process.execPath), filename)
		fs.writeFileSync(filePath, contents, {encoding: 'utf-8', mode: 0o400})

		return filePath
	}
}