/// <reference path="../../types.d.ts" />
/// <reference path="../../../settings/types.d.ts" />

import fs from "./modules/api/fs";
import path from "./modules/api/path";
import BdApi from "./modules/bdapi";
import DataStore from "./modules/datastore";
import DiscordModules from "./modules/discord";
import DOM from "./modules/dom";
import PluginsManager from "./modules/pluginsmanager";
import Require from "./modules/require";
import ThemesManager from "./modules/themesmanager";
import Toasts from "./modules/toasts";
import Webpack from "./modules/webpack";
import AddonPanel from "./ui/addonpanel";
import SettingsPanel from "./ui/settings";
import Buffer, {setBuffer} from "./modules/api/buffer";
import Logger from "./modules/logger";
import SettingsManager from "./modules/settingsmanager";
import AddonUpdater from "./modules/addonupdater";
import * as IPCEvents from "../common/IPCEvents";
import BDLogo from "./ui/icons/bdlogo";
import Patcher from "./modules/patcher";

const SettingsSections = [
    {section: "DIVIDER"},
    {
        section: "HEADER",
        label: "BetterDiscord"
    },
    {
        id: "bdcompat-settings-settings",
        section: "settings",
        label: "Settings",
        className: "bdcompat-settings-item-settings",
        element: () => DiscordModules.React.createElement(SettingsPanel, {})
    },
    {
        id: "bdcompat-settings-plugins",
        section: "plugins",
        label: "Plugins",
        className: "bdcompat-settings-item-plugins",
        element: () => DiscordModules.React.createElement(AddonPanel, {manager: PluginsManager, type: "plugin"})
    },
    {
        id: "bdcompat-settings-themes",
        section: "themes",
        label: "Themes",
        className: "bdcompat-settings-item-themes",
        element: () => DiscordModules.React.createElement(AddonPanel, {manager: ThemesManager, type: "theme"})
    }
];

if (!window.process) {
    BDCompatNative.IPC.dispatch(IPCEvents.EXPOSE_PROCESS_GLOBAL);
}

declare global {
    const webpackJsonp: any[];
    const isUnbound: boolean;

    interface Window {
        webpackJsonp: any[];
        isUnbound: boolean;
    }
}

export default new class BDCompat {
    styles = ["./ui/toast.css", "./ui/addons.css", "./ui/settings.css"];
    _flush = [];

    start() {
        Logger.log("Core", "Loading...");
        Webpack.whenReady.then(this.onStart.bind(this));
    }

    onStart() {
        this.polyfillWebpack();
        setBuffer(Webpack.findByProps("Buffer"));

        if ((process as any)?.contextIsolated ?? true) {
            window.require = Require as any;
            window.Buffer = Buffer.Buffer;
        }

        Object.assign(window, {
            "bd_require": Require,
            BDInternal: {
               SettingsManager,
               AddonUpdater,
               Webpack,
               Patcher,
               DataStore,
               Toasts,
               DiscordModules
            },
            React: DiscordModules.React
        });

        this.exposeBdApi();

        DataStore.initialize();
        SettingsManager.initialize();
        Toasts.initialize();
        this.appendStyles();

        AddonUpdater.initialize();
        ThemesManager.initialize();
        PluginsManager.initialize();
        AddonUpdater.checkAllUpdates();
        this.injectSettings();
    }

    exposeBdApi() {
        Object.freeze(BdApi);
        Object.freeze(BdApi.Plugins);
        Object.freeze(BdApi.Themes);
        Object.freeze(BdApi.Patcher);

        Object.defineProperty(window, "BdApi", {
            value: BdApi,
            configurable: false,
            writable: false
        });
    }

    polyfillWebpack() {
        if (typeof(webpackJsonp) !== "undefined") return;

        window.webpackJsonp = [];

        Object.defineProperty(window.webpackJsonp, "__polyfill", {value: true});

        window.webpackJsonp.length = 10000; // In case plugins are waiting for that.
        window.webpackJsonp.flat = () => window.webpackJsonp;

        window.webpackJsonp.push = ([[], module, [[id]]]) => {
            return module[id]({}, {}, Webpack.request());
        };
    }

    appendStyles() {
        const dist = BDCompatNative.executeJS("__dirname", new Error().stack);
        const stylesPath = path.resolve(dist, "style.css");
        if (!fs.existsSync(stylesPath)) return;

        DOM.injectCSS("core", fs.readFileSync(stylesPath, "utf8"));
    }

    async injectSettings() {
        if (window.isUnbound) return;

        if ("SettingsNative" in window) {
            if (typeof KernelSettings === "undefined") await new Promise<void>(resolve => {
                const listener = () => {
                    resolve();
                    DiscordModules.Dispatcher.unsubscribe("KERNEL_SETTINGS_INIT", listener);
                };

                DiscordModules.Dispatcher.subscribe("KERNEL_SETTINGS_INIT", listener);
            });

            for (const panel of SettingsSections) {
                if (panel.section === "HEADER" || panel.section === "DIVIDER") continue;

                this._flush.push(KernelSettings.register("BetterDiscord" + panel.label, {
                    ...panel,
                    render: panel.element,
                    icon: React.createElement(BDLogo, {
                        className: "bd-logo",
                        width: 16,
                        height: 16
                    })
                }));
            }
        } else {
            BdApi.alert("Missing Dependency", <>
                BetterDiscord Compatibility requires the <a onClick={() => {
                    open("https://github.com/strencher-kernel/settings")
                }}>settings</a> package to register its settings tabs.
            </>);
        }
    }

    stop() {
        for (let i = 0; i < this._flush.length; i++) {
            this._flush[i]();
        }
    }
}
