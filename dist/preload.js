"use strict";
var electron = require("electron"),
	NodeModule = require("module"),
	path = require("path");
function _interopDefaultLegacy(e) {
	return e && "object" == typeof e && "default" in e ? e : {
		default: e
	}
}
var NodeModule__default = _interopDefaultLegacy(NodeModule),
	path__default = _interopDefaultLegacy(path);
const events = {},
	IPC = {
		on(e, t) {
			return events[e] || (events[e] = new Set), events[e].add(t), IPC.off.bind(null, e, t)
		},
		off(e, t) {
			events[e] && (events[e].delete(t), events[e].size ||
			delete events[e]
			)
		},
		once(e, t) {
			const o = IPC.on(e, (...e) => (o(), t(...e)))
		},
		dispatch(e, ...t) {
			if (events[e])
				for (const o of events[e]) try {
						o(...t)
					} catch (e) {
						console.error(e)
			}
		}
	};
function HookOnSwitch() {
	electron.ipcRenderer.on("bdcompat-did-navigate", () => IPC.dispatch("navigate")), electron.ipcRenderer.send("bdcompat-setup-onSwitch")
}
const GET_APP_PATH = "bdcompat-get-app-path",
	EXPOSE_PROCESS_GLOBAL = "bdcompat-expose-process-global";
function getKeys(e) {
	const t = [];
	for (const o in e) t.push(o);
	return t
}
function cloneObject(o, e = {}, t) {
	return (t = Array.isArray(t) ? t : getKeys(o)).reduce((e, t) => ("object" != typeof o[t] || Array.isArray(o[t]) || null === o[t] ? "function" == typeof o[t] ? e[t] = o[t].bind(o) : e[t] = o[t] : e[t] = cloneObject(o[t], {}), e), e)
}
function exposeGlobal(e, t, {preload: o=!0, renderer: r=!0} = {}) {
	r && electron.contextBridge.exposeInMainWorld(e, t), o && (window[e] = t)
}
Object.assign(window, {
	__cloneObject: cloneObject,
	__getKeys: getKeys
});
const Process = cloneObject(process),
	Module = (Process.env.injDir = __dirname, NodeModule__default.default),
	API = (HookOnSwitch(), {
		getAppPath() {
			return electron.ipcRenderer.sendSync(GET_APP_PATH)
		},
		getBasePath() {
			return path__default.default.resolve(__dirname, "..")
		},
		executeJS(js, stack) {
			return eval(`
            try {
                ${js}
            } catch (error) {
                console.groupCollapsed("%c[BDCompatNative::executeJS] Fatal Error:%c", "color: red; background: #290000", "background: #290000", error.message);
                console.error("Caller stack:", Object.assign(new Error(error.message), {stack: stack}));
                console.error("Preload stack:", error);
                console.groupEnd();
                throw error;
            }
        `)
		},
		IPC: IPC
	});
{
	const appPath = path__default.default.resolve(API.getAppPath(), "node_modules");
	Module.globalPaths.indexOf(appPath) < 0 && Module.globalPaths.push(appPath)
}
exposeGlobal("BDCompatNative", API), exposeGlobal("BDCompatEvents", events, {
	renderer: !1
}), process.contextIsolated && IPC.once(EXPOSE_PROCESS_GLOBAL, () => {
	exposeGlobal("process", Process, {
		preload: !1
	})
});
