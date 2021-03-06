//@flow
import {LoginFacade} from "./facades/LoginFacade"
import {WorkerImpl} from "./WorkerImpl"
import {module as replaced} from "@hot"
import {Indexer} from "./search/Indexer"
import {EntityRestClient} from "./rest/EntityRestClient"
import {UserManagementFacade} from "./facades/UserManagementFacade"
import {EntityRestCache} from "./rest/EntityRestCache"
import {GroupManagementFacade} from "./facades/GroupManagementFacade"
import {MailFacade} from "./facades/MailFacade"
import {MailAddressFacade} from "./facades/MailAddressFacade"
import {FileFacade} from "./facades/FileFacade"
import {SearchFacade} from "./search/SearchFacade"
import {CustomerFacade} from "./facades/CustomerFacade"
import {CounterFacade} from "./facades/CounterFacade"
import {EventBusClient} from "./EventBusClient"
import {assertWorkerOrNode, isAdminClient} from "../Env"
import {CloseEventBusOption} from "../common/TutanotaConstants"
import type {BrowserData} from "../../misc/ClientConstants"

assertWorkerOrNode()
type WorkerLocatorType = {
	login: LoginFacade;
	indexer: Indexer;
	cache: EntityRestCache;
	search: SearchFacade;
	groupManagement: GroupManagementFacade;
	userManagement: UserManagementFacade;
	customer: CustomerFacade;
	file: FileFacade;
	mail: MailFacade;
	mailAddress: MailAddressFacade;
	counters: CounterFacade;
	eventBusClient: EventBusClient;
	_indexedDbSupported: boolean;
	_browserData: BrowserData;
}

export const locator: WorkerLocatorType = ({}: any)

export function initLocator(worker: WorkerImpl, indexedDbSupported: boolean, browserData: BrowserData) {
	locator._browserData = browserData
	locator._indexedDbSupported = indexedDbSupported
	locator.login = new LoginFacade(worker)
	locator.indexer = new Indexer(new EntityRestClient(locator.login), worker, indexedDbSupported, browserData)
	locator.cache = isAdminClient() ? (new EntityRestClient(locator.login): any) : new EntityRestCache(new EntityRestClient(locator.login)) // we don't wont to cache within the admin area
	locator.search = new SearchFacade(locator.login, locator.indexer.db, locator.indexer._mail, [
		locator.indexer._contact.suggestionFacade, locator.indexer._groupInfo.suggestionFacade,
		locator.indexer._whitelabelChildIndexer.suggestionFacade
	])
	locator.counters = new CounterFacade()
	locator.groupManagement = new GroupManagementFacade(locator.login, locator.counters)
	locator.userManagement = new UserManagementFacade(worker, locator.login, locator.groupManagement, locator.counters)
	locator.customer = new CustomerFacade(worker, locator.login, locator.groupManagement, locator.userManagement, locator.counters)
	locator.file = new FileFacade(locator.login)
	locator.mail = new MailFacade(locator.login, locator.file)
	locator.mailAddress = new MailAddressFacade(locator.login)
	locator.eventBusClient = new EventBusClient(worker, locator.indexer, locator.cache, locator.mail, locator.login)
	locator.login.init(locator.indexer, locator.eventBusClient)
}

export function resetLocator(): Promise<void> {
	return locator.login.reset().then(() => initLocator(locator.login._worker, locator._indexedDbSupported, locator._browserData))
}

if (typeof self !== "undefined") {
	self.locator = locator // export in worker scope
}
// hot reloading
if (replaced) {
	if (replaced.locator.login) {
		Object.assign(locator.login, replaced.locator.login)
		// close the websocket, but do not reset the state
		if (locator.login._eventBusClient._socket && locator.login._eventBusClient._socket.close) { // close is undefined in node tests
			locator.login._eventBusClient.close(CloseEventBusOption.Reconnect);
		}
		if (locator.login.isLoggedIn()) {
			locator.login._eventBusClient.connect(false)
		}
	}


	if (replaced.locator.indexer) {
		Object.assign(locator.indexer, replaced.locator.indexer)
	}

	if (replaced.locator.search) {
		Object.assign(locator.search, replaced.locator.search)
	}
}
