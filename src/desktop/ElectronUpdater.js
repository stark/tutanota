// @flow
import {autoUpdater} from 'electron-updater'
import DesktopNotifier from './DesktopNotifier.js'

export default class ElectronUpdater {

	static start() {
		//autoUpdater.autoInstallOnAppQuit = false
		autoUpdater.logger = {
			info: (m) => console.log("info: ", m),
			debug: (m) => console.log("debug: ", m),
			verbose: (m) => console.log("verbose: ", m),
			error: (m) => console.log("ERROR: ", m),
			warn: (m) => console.log("warn: ", m),
			silly: (m) => console.log("silly: ", m)
		}

		autoUpdater.on('checking-for-update', () => {
			autoUpdater.logger.info('[o] Checking for update...');
		})

		autoUpdater.on('update-available', (info) => {
			autoUpdater.logger.info('[o] Update available. ' + JSON.stringify(info, null, 2));
		})

		autoUpdater.on('update-downloaded', (info) => {
			DesktopNotifier.showOneShot({
				title: `Update available (${info.version})`,
				body: `Click here if you want to apply it now, or let us auto install on quit.`,
				clickHandler: () => {
					autoUpdater.quitAndInstall(false, true)
				}
			})
		})

		autoUpdater.checkForUpdates().then((result) => {
			console.log("checkUpdatesResult: ", JSON.stringify(result, null, 2))
		})
	}
}