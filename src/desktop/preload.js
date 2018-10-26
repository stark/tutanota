// @flow
import {ipcRenderer, remote} from 'electron'

const app = remote.require('electron').app

function sendMessage(msg, args) {
	return ipcRenderer.send(msg, args);
}

function receiveMessage(msg, listener) {
	return ipcRenderer.on(msg, listener)
}

function removeListener(msg, listener) {
	return ipcRenderer.removeListener(msg, listener)
}

ipcRenderer.on('get-translations', () => {
	const translations = {
		translations: window.tutao.lang.translations,
		fallback: window.tutao.lang.fallback,
		code: window.tutao.lang.code,
		languageTag: window.tutao.lang.languageTag,
		staticTranslations: window.tutao.lang.staticTranslations,
		formats: window.tutao.lang.formats,
	}
	ipcRenderer.send('get-translations', translations)
})

const bridge: Bridge = {
	sendMessage: (msg: BridgeMessage, data: any) => sendMessage(msg, data),
	startListening: (msg: BridgeMessage, listener: Function) => receiveMessage(msg, listener),
	stopListening: (msg: BridgeMessage, listener: Function) => removeListener(msg, listener),
	getVersion: () => app.getVersion(),
}

window.bridge = bridge
window.focus = () => {
	ipcRenderer.send('show-window')
}