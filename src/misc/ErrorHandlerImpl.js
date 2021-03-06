// @flow
import {
	AccessBlockedError,
	AccessDeactivatedError,
	AccessExpiredError,
	ConnectionError,
	InsufficientStorageError,
	InvalidSoftwareVersionError,
	NotAuthenticatedError,
	ServiceUnavailableError,
	SessionExpiredError
} from "../api/common/error/RestError"
import {Dialog} from "../gui/base/Dialog"
import {worker} from "../api/main/WorkerClient"
import {TextField, Type} from "../gui/base/TextField"
import m from "mithril"
import {lang} from "./LanguageViewModel"
import {assertMainOrNode, getHttpOrigin, isIOSApp, Mode} from "../api/Env"
import {AccountType, ConversationType} from "../api/common/TutanotaConstants"
import {neverNull} from "../api/common/utils/Utils"
import {createRecipientInfo} from "../mail/MailUtils"
import {logins} from "../api/main/LoginController"
import {client} from "./ClientDetector"
import {OutOfSyncError} from "../api/common/error/OutOfSyncError"
import stream from "mithril/stream/stream.js"
import {SecondFactorPendingError} from "../api/common/error/SecondFactorPendingError"
import {secondFactorHandler} from "../login/SecondFactorHandler"
import {showProgressDialog} from "../gui/base/ProgressDialog"
import {IndexingNotSupportedError} from "../api/common/error/IndexingNotSupportedError"
import * as UpgradeWizard from "../subscription/UpgradeSubscriptionWizard"
import {windowFacade} from "./WindowFacade"
import {generatedIdToTimestamp} from "../api/common/utils/Encoding"
import {formatPrice} from "./Formatter"

assertMainOrNode()

let unknownErrorDialogActive = false
let notConnectedDialogActive = false
let invalidSoftwareVersionActive = false
let loginDialogActive = false
let isLoggingOut = false
let serviceUnavailableDialogActive = false

export function handleUncaughtError(e: Error) {
	if (isLoggingOut) {
		// ignore all errors while logging out
		return
	}

	if (e instanceof ConnectionError) {
		if (!notConnectedDialogActive) {
			notConnectedDialogActive = true
			var checkForMaintenance = function () {
				var img = document.createElement("img")
				img.onload = function () {
					Dialog.error("serverDownForMaintenance_msg").then(() => {
						notConnectedDialogActive = false
					})
				}
				img.onerror = function () {
					// if (tutao.env.isAndroidApp()) {
					// 	tutao.locator.modalDialogViewModel.showDialog([tutao.lang("upgradeSystemWebView_msg")], ["ok_action"], null, "https://play.google.com/store/apps/details?id=com.google.android.webview", null)
					// } else {
					Dialog.error("serverNotReachable_msg").then(() => {
						notConnectedDialogActive = false
					})
					// }
				}
				img.src = "https://tutanota.com/images/maintenancecheck.png"
			}
			checkForMaintenance()
		}
	} else if (e instanceof InvalidSoftwareVersionError) {
		if (!invalidSoftwareVersionActive) {
			invalidSoftwareVersionActive = true
			Dialog.error("outdatedClient_msg").then(() => invalidSoftwareVersionActive = false)
		}
	} else if (e instanceof NotAuthenticatedError || e instanceof AccessBlockedError || e
		instanceof AccessDeactivatedError || e instanceof AccessExpiredError) {
		windowFacade.reload({})
	} else if (e instanceof SessionExpiredError) {
		if (!loginDialogActive) {
			loginDialogActive = true
			let errorMessage = stream("")
			let pwInput = new TextField("password_label", errorMessage)
				.setType(Type.Password)
			let dialog = Dialog.showActionDialog({
				title: lang.get("login_label"),
				child: pwInput,
				okAction: () => {
					showProgressDialog("pleaseWait_msg",
						worker.createSession(neverNull(logins.getUserController().userGroupInfo.mailAddress),
							pwInput.value(), client.getIdentifier(), false, true)
						      .then(() => {
							      dialog.close()
							      loginDialogActive = false
						      })
						      .catch(AccessBlockedError, e => {
							      errorMessage(lang.get('loginFailedOften_msg'))
							      m.redraw()
						      })
						      .catch(NotAuthenticatedError, e => {
							      errorMessage(lang.get('loginFailed_msg'))
							      m.redraw()
						      })
						      .catch(AccessDeactivatedError, e => {
							      errorMessage(lang.get('loginFailed_msg'))
							      m.redraw()
						      })
						      .catch(ConnectionError, e => {
							      errorMessage(lang.get('emptyString_msg'))
							      m.redraw()
							      throw e;
						      })
					)
						.finally(() => secondFactorHandler.closeWaitingForSecondFactorDialog())
				},
				allowCancel: false
			})
		}
	} else if (e instanceof SecondFactorPendingError) {
		secondFactorHandler.showWaitingForSecondFactorDialog(e.data.sessionId, e.data.challenges)
	} else if (e instanceof OutOfSyncError) {
		Dialog.error("dataExpired_msg")
	} else if (e instanceof InsufficientStorageError) {
		if (logins.getUserController().isGlobalAdmin()) {
			Dialog.error("insufficientStorageAdmin_msg").then(() => {
				// tutao.locator.navigator.settings()
				// tutao.locator.settingsViewModel.show(tutao.tutanota.ctrl.SettingsViewModel.DISPLAY_ADMIN_STORAGE)
			})
		} else {
			Dialog.error("insufficientStorageUser_msg")
		}
	} else if (e instanceof ServiceUnavailableError) {
		if (!serviceUnavailableDialogActive) {
			serviceUnavailableDialogActive = true;
			Dialog.error("serviceUnavailable_msg").then(() => {
				serviceUnavailableDialogActive = false;
			})
		}
	} else if (e instanceof IndexingNotSupportedError) {
		// external users do not search anyway
		if (logins.isInternalUserLoggedIn()) {
			Dialog.error("searchDisabled_msg")
		}
	} else {
		if (!unknownErrorDialogActive) {
			unknownErrorDialogActive = true
			if (logins.isUserLoggedIn()) {
				// only logged in users can report errors
				let timestamp = new Date()
				let textField = new TextField("yourMessage_label", () => lang.get("feedbackOnErrorInfo_msg"))
				textField.type = Type.Area
				let errorOkAction = (dialog) => {
					unknownErrorDialogActive = false
					_sendFeedbackMail(textField.value(), timestamp, e)
					dialog.close() // show progress & then close?
				}

				Dialog.showActionDialog({
					title: lang.get("errorReport_label"),
					child: {view: () => m(textField)},
					okAction: errorOkAction,
					cancelAction: () => {
						unknownErrorDialogActive = false
					}
				})
			} else {
				console.log("Unknown error", e)
				Dialog.error("unknownError_msg").then(() => {
					unknownErrorDialogActive = false
				})
			}
		}
	}
}

function _sendFeedbackMail(message: string, timestamp: Date, error: Error): Promise<void> {
	let type = neverNull(Object.keys(AccountType)
	                           .find(typeName => (AccountType[typeName] === logins.getUserController().user.accountType)))
	message += "\n\n Client: " + (env.mode === Mode.App ? (env.platformId != null ? env.platformId : "")
		+ " app" : "Browser")
	message += "\n Type: " + type
	message += "\n Tutanota version: " + env.versionNumber
	message += "\n Timestamp (UTC): " + timestamp.toUTCString()
	message += "\n User agent: \n" + navigator.userAgent
	if (error && error.stack) {
		// the error id is included in the stacktrace
		message += "\n\n Stacktrace: \n" + error.stack
	}

	message = message.split("\n").join("<br>")
	var subject = ((error && error.name) ? "Feedback new client - " + error.name : "Feedback new client - ?") + " "
		+ type
	var recipient = createRecipientInfo("support@tutao.de", "", null, true)
	return worker.createMailDraft(subject, message, neverNull(logins.getUserController().userGroupInfo.mailAddress), "", [recipient], [], [], ConversationType.NEW, null, [], true, [])
	             .then(draft => {
		             return worker.sendMailDraft(draft, [recipient], "de")
	             })
}

/**
 * Shows warnings if the invoices is not paid or the registration is not approved yet.
 * @param includeInvoiceNotPaidForAdmin If true, also shows a warning for an admin if the invoice is not paid (use at login), if false does not show this warning (use when sending an email).
 * @param defaultStatus This status is used if the actual status on the customer is "0"
 * @returns True if the user may still send emails, false otherwise.
 */
export function checkApprovalStatus(includeInvoiceNotPaidForAdmin: boolean, defaultStatus: ?string): Promise<boolean> {
	if (!logins.getUserController().isInternalUser()) { // external users are not authorized to load the customer
		return Promise.resolve(true)
	}
	return logins.getUserController().loadCustomer().then(customer => {
		let status = (customer.approvalStatus == "0" && defaultStatus) ? defaultStatus : customer.approvalStatus
		if (["1", "5", "7"].indexOf(status) != -1) {
			return Dialog.error("waitingForApproval_msg").return(false)
		} else if (status == "6") {
			if ((new Date().getTime() - generatedIdToTimestamp(customer._id)) > (2 * 24 * 60 * 60 * 1000)) {
				return Dialog.error("requestApproval_msg").return(true)
			} else {
				return Dialog.error("waitingForApproval_msg").return(false)
			}
		} else if (status === "3") {
			if (logins.getUserController().isGlobalAdmin()) {
				if (includeInvoiceNotPaidForAdmin) {
					return Dialog.error(() => {
						return lang.get("invoiceNotPaid_msg", {"{1}": getHttpOrigin()})
					}).then(() => {
						// TODO: navigate to payment site in settings
						//m.route.set("/settings")
						//tutao.locator.settingsViewModel.show(tutao.tutanota.ctrl.SettingsViewModel.DISPLAY_ADMIN_PAYMENT);
					}).return(true)
				} else {
					return true
				}
			} else {
				return Dialog.error("invoiceNotPaidUser_msg").return(false)
			}
		} else if (status === "4") {
			Dialog.error("loginAbuseDetected_msg") // do not logout to avoid that we try to reload with mail editor open
			return false
		} else {
			return true
		}
	})
}

export function showNotAvailableForFreeDialog(isInPremiumIncluded: boolean) {
	if (isIOSApp()) {
		Dialog.error("notAvailableInApp_msg")
	} else {
		let message = lang.get(!isInPremiumIncluded ? "onlyAvailableForPremiumNotIncluded_msg" : "onlyAvailableForPremium_msg") + " "
			+ lang.get("premiumOffer_msg", {"{1}": formatPrice(1, true)})
		Dialog.reminder(lang.get("upgradeReminderTitle_msg"), message, "https://tutanota.com/blog/posts/premium-pro-business")
			.then(confirmed => {
				if (confirmed) {
					UpgradeWizard.show()
				}
			})
	}
}

export function loggingOut() {
	isLoggingOut = true
	showProgressDialog("loggingOut_msg", Promise.fromCallback(cb => null))
}