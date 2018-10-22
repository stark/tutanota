// @flow
import {Notification} from 'electron'

export default class DesktopNotifier {

	static isAvailable(): boolean {
		return Notification.isSupported()
	}

	/**
	 * Shows a simple Desktop Notification to the user, once.
	 * @param props.title title of the notification
	 * @param props.body body message. keep to less than 200 bytes for maximum compatibility.
	 * @param props.clickHandler Called when the user clicks the notification
	 * @param props.closeHandler Called when the notification was closed (by timeout or user action).
	 */
	static showOneShot(props: {|
		title: string,
		body?: string,
		icon?: string,
		clickHandler?: Function,
		closeHandler?: Function
	|}): void {
		const {title, body, icon, clickHandler, closeHandler} =
			Object.assign({}, {body: "", clickHandler: () => {}, closeHandler: () => {}}, props)
		const oneshot = new Notification({
			"title": title,
			"icon": icon,
			"body": body,
		})
		oneshot.on('click', clickHandler)
		oneshot.on('close', closeHandler)
		oneshot.show()
	}
}