// @flow
import {autoUpdater} from 'electron-updater'
import {DesktopNotifier, NotificationResult} from './DesktopNotifier.js'
import {lang} from './DesktopLocalizationProvider'

export default class ElectronUpdater {

	static start() {
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
				title: lang.get('updateAvailable_label', {"{version}": info.version}),
				body: lang.get('clickToUpdate_msg'),
			}).then((res) => {
				if (res === NotificationResult.Click) {
					autoUpdater.quitAndInstall(false, true)
				}
			})
		})

		autoUpdater
			.checkForUpdates()
			.then((result) => {
				console.log("checkUpdatesResult: ", JSON.stringify(result, null, 2))
			})
	}
}