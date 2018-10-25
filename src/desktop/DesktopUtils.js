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

	static registerAsMailtoHandler(tryToElevate: boolean): Promise<void> {
		switch (process.platform) {
			case "win32":
				return checkForAdminStatus()
					.then((isAdmin) => {
						if (!isAdmin && tryToElevate) {
							return _elevateWin(process.execPath, ["-r"])
						} else if (isAdmin) {
							return _registerOnWin()
						}
					})
			case "darwin":
				return Promise.resolve()
			case "linux":
				return Promise.resolve()
		}
	}

	static unregisterAsMailtoHandler(tryToElevate: boolean): Promise<void> {
		switch (process.platform) {
			case "win32":
				return checkForAdminStatus()
					.then((isAdmin) => {
						if (!isAdmin && tryToElevate) {
							return _elevateWin(process.execPath, ["-u"])
						} else if (isAdmin) {
							return _unregisterOnWin()
						}
					})
			case "darwin":
				return Promise.resolve()
			case "linux":
				return Promise.resolve()
		}
	}
}

/**
 * Checks if the user has admin privileges
 * @returns {boolean} true if user has admin privileges
 */
function checkForAdminStatus(): Promise<boolean> {
	let deferred = defer()
	switch (process.platform) {
		case "win32":
			exec('NET SESSION', (err, so, se) => {
				console.log(se.length === 0 ? "admin" : "not admin");
				deferred.resolve(se.length === 0)
			})
			break;
		default:
			deferred.resolve(true)
	}
	return deferred.promise
}

/**
 * Writes contents to the file filename into the directory of the executable
 * @param filename
 * @param contents
 * @returns {*} path  to the written file
 * @private
 */
function _writeToDisk(filename: string, contents: string): string {
	console.log("Wrote file to ", filename)
	const filePath = path.join(path.dirname(process.execPath), filename)
	fs.writeFileSync(filePath, contents, {encoding: 'utf-8', mode: 0o400})
	return filePath
}

/**
 * uses the bundled elevate.exe to show a UAC dialog to the user and execute command with elevated permissions
 * @param command
 * @param args
 * @returns {Promise<T>}
 * @private
 */
function _elevateWin(command: string, args: Array<string>) {
	const deferred = defer()
	const elevateExe = path.join((process: any).resourcesPath, "elevate.exe")
	let elevateArgs = ["-wait", command].concat(args)
	spawn(elevateExe, elevateArgs, {
		stdio: ['ignore', 'inherit', 'inherit'],
		detached: false
	}).on('exit', (code, signal) => {
		console.log("code: ", code)
		if (code === 0) {
			deferred.resolve()
		} else {
			deferred.reject(new Error("couldn't elevate permissions"))
		}
	})
	return deferred.promise
}

/**
 * this will silently fail if we're not admin.
 * @param script: path to registry script
 * @private
 */
function _executeRegistryScript(script: string): Promise<void> {
	const deferred = defer()
	const file = _writeToDisk(crypto.randomBytes(12).toString('hex'), script)
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


function _registerOnWin(): Promise<void> {
	const tmpRegScript = require('./reg-templater.js').registerKeys(process.execPath)
	return _executeRegistryScript(tmpRegScript)
		.then(() => app.setAsDefaultProtocolClient('mailto'))
}

function _unregisterOnWin(): Promise<void> {
	app.removeAsDefaultProtocolClient('mailto')
	const tmpRegScript = require('./reg-templater.js').unregisterKeys()
	return _executeRegistryScript(tmpRegScript)
}