// @flow
import {app} from 'electron'
import ElectronUpdater from './ElectronUpdater.js'
import {MainWindow} from './MainWindow'
import DesktopNotifier from "./DesktopNotifier"
import DesktopUtils from './DesktopUtils'

let mainWindow: MainWindow

app.setAppUserModelId("de.tutao.tutanota")
console.log("argv: ", process.argv)
console.log("version:  ", app.getVersion())

const main = () => {
	if (!app.requestSingleInstanceLock()) {
		app.exit()
	}

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit()
		}
	})

	app.on('activate', () => {
		if (mainWindow === null) {
			mainWindow = new MainWindow()
		}
		mainWindow.show()
	})

	app.on('second-instance', (e, argv, cwd) => {
		if (mainWindow) {
			mainWindow.show(argv.find((arg) => arg.startsWith('mailto')))
		}
	})

	app.on('ready', () => {
		mainWindow = new MainWindow()
		console.log("mailto handler: ", app.isDefaultProtocolClient("mailto"))
		console.log("notifications: ", DesktopNotifier.isAvailable())

		setTimeout(() => DesktopNotifier.showOneShot({
			title: "Hey!",
			body: "Click to try to become standard handler for mailto.",
			clickHandler: () => {
				DesktopUtils.registerAsMailtoHandler(true)
				            .then(() => console.log("successfully registered as mailto handler"))
				            .catch(() => console.log("could not register as mailto handler"))
			}
		}), 2500)
		ElectronUpdater.start()
	})
}

//check if there are any cli parameters that can be handled without a window
if (process.argv.indexOf("-r") !== -1) {
	//register as mailto handler, then quit
	DesktopUtils.registerAsMailtoHandler(false)
	            .then(() => app.exit(0))
	            .catch(() => app.exit(1))
} else if (process.argv.indexOf("-u") !== -1) {
	//unregister as mailto handler, then quit
	DesktopUtils.unregisterAsMailtoHandler(false)
	            .then(() => app.exit(0))
	            .catch(() => app.exit(1))
} else { //normal start
	main()
}