// @flow
import {app} from 'electron'
import ElectronUpdater from './ElectronUpdater.js'
import {MainWindow} from './MainWindow.js'
import DesktopUtils from './DesktopUtils.js'
import {DesktopNotifier} from "./DesktopNotifier.js"
import {lang} from './DesktopLocalizationProvider.js'
import IPC from './IPC.js'

let mainWindow: MainWindow

app.setAppUserModelId("de.tutao.tutanota")
console.log("argv: ", process.argv)
console.log("version:  ", app.getVersion())

const createMainWindow = () => {
	mainWindow = new MainWindow()
	console.log("mailto handler: ", app.isDefaultProtocolClient("mailto"))
	console.log("notifications: ", DesktopNotifier.isAvailable())
	IPC.on('webapp-ready', main)
}

const main = () => {
	console.log("Webapp ready")
	DesktopNotifier.start()
	ElectronUpdater.start()
	lang.init()
	    .catch((e) => {
		    console.log("error during lang init: ", e)
		    throw e
	    })
	// .then(() => {
	//    return DesktopNotifier
	//     .showOneShot({
	// 	    title: lang.get('yearly_label'),
	// 	    body: lang.get('amountUsedAndActivatedOf_label', {"{used}": 'nutzt', "{active}": 'aktiv', "{totalAmount}": 'max'}),
	//     })
	// })
	// .then((res) => {
	//    if (res !== NotificationResult.Click) {
	//     return Promise.reject()
	//    }
	//    return DesktopUtils.registerAsMailtoHandler(true)
	// })
	// .then(() => console.log("successfully registered as mailto handler "))
	// .catch(() => "did not register as mailto handler")
}

//check if there are any cli parameters that should be handled without a window
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

	app.on('ready', createMainWindow)
}