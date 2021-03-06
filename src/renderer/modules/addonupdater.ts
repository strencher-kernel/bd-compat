import UpdaterButton from "../ui/updater/button";
import DiscordModules from "./discord";
import DOM from "./dom";
import Logger from "./logger";
import PluginsManager from "./pluginsmanager";
import ThemesManager from "./themesmanager";
import * as https from "./api/https";
import fs from "./api/fs";
import {UpdaterApi} from "../stores/updater";
import Toasts from "./toasts";
import Events from "./events";

const warnings = new Set();

export class UpdaterNode {
    code: string;
    currentVersion: string;
    remoteVersion: string;
    addon: any;
    pending: boolean;

    constructor(addon: any, code: string, currentVersion: string, remoteVersion: string, pending: boolean) {
        Object.assign(this, {code, currentVersion, remoteVersion, addon, pending});
    }

    async update(showToast?: boolean) {
        await new Promise<Error | void>((res, rej) => {
            fs.writeFile(this.addon.path, this.code, (error) => {
                if (error) rej(error);
                else res();
            });
        });

        UpdaterApi.setState(state => {
            const updates = {...state.updates};
            delete updates[this.addon.name];
            return {updates};
        });

        if (showToast) this.showNotice();
    }

    showNotice() {
        Toasts.show(`${this.addon.name} was updated from ${this.currentVersion} to ${this.remoteVersion}.`);
    }
}

export default class AddonUpdater {
    static versionRegex = /['"][0-9]+\.[0-9]+\.[0-9]+['"]/i;

    static getAddons(type: "theme" | "plugin") {
        let manager: typeof PluginsManager | typeof ThemesManager; switch (type) {
            case "plugin": {manager = PluginsManager; break;}
            case "theme": {manager = ThemesManager; break;}

            default: {
                Logger.error("AddonUpdater", `Unsupported addon type: ${type}`);
                return {};
            }
        }

        if (!manager) return;

        return Object.fromEntries(manager.addons.map(addon => [addon.name, {
            version: this.parseVersion(addon),
            addon,
            updateUrl: addon.updateUrl ?? addon.instance?._config?.info?.github_raw
        }]));
    }

    static parseVersionString(code: string) {
        const version = code.match(this.versionRegex)?.toString();
        if (!version) return null;

        return version.replace(/['"]/g, "");
    }

    static parseVersion(addonOrString: any) {
        if (typeof (addonOrString) === "string") return this.parseVersionString(addonOrString);
        // Fix some plugins. :zere_zoom:
        if (addonOrString.instance?._config?.info?.version) return addonOrString.instance?._config?.info?.version;
        if (addonOrString.version) return addonOrString.version;
        if (typeof (addonOrString.instance?.getVersion) === "function") return addonOrString.instance.getVersion() ?? "0.0.0";

        return "0.0.0";
    }

    static initialize() {
        const wrapper = DOM.createElement("div", {className: "bd-updater-wrapper"});

        DiscordModules.ReactDOM.render(React.createElement(UpdaterButton, {}), wrapper);

        document.body.appendChild(wrapper);

        this.patchZlibUpdater();

        setInterval(() => this.checkAllUpdates(), 1.8e+6); // 30minutes
    }

    static async patchZlibUpdater() {
        await new Promise(loaded => Events.once("ZERES_LIB_LOADED", loaded));

        try {
            const updater = (window as any).ZLibrary?.PluginUpdater;
            if (updater && typeof(updater.processUpdateCheck) === "function") {
                updater.processUpdateCheck = async () => {};
                updater.showUpdateNotice = () => {};
            }
    
            Logger.info("AddonUpdater", "Patched ZeresLib updater.");
        } catch (error) {
            Logger.error("AddonUpdater", "Failed to patch zlibrary updater:", error);
        }
    }

    static async checkAllUpdates() {
        let found = {};
        for (const type of ["theme", "plugin"]) {
            const addons = this.getAddons(type as "theme" | "plugin");

            for (const addonId in addons) {
                const {addon, updateUrl} = addons[addonId];

                if (!updateUrl) {
                    if (!warnings.has(addonId)) {
                        Logger.warn(`AddonUpdater:${type}s`, `Could not resolve updating url for ${addonId}.`);
                        warnings.add(addonId);
                    }
                    continue;
                }

                try {
                    const data = await this.fetchUpdate(addon, updateUrl);
                    if (data.pending) found[addonId] = {
                        type: type,
                        data
                    };
                } catch (error) {
                    Logger.error("AddonUpdater", `Failed to fetch update for ${addonId}:`, error);
                }
            }
        }

        if ((Object.keys(found) as unknown as number) == 0) return;

        UpdaterApi.setState(state => ({
            updates: Object.assign({}, state.updates, found)
        }));
    }

    static fetchUpdate(addon: any, url: string) {
        return new Promise<UpdaterNode>((resolve, rej) => {
            https.request(url, res => {
                const data: any[] = [];

                res.on("data", chunk => data.push(chunk));

                res.on("end", () => {
                    const raw = data.join("");

                    const remoteVersion = this.parseVersionString(raw);
                    const localVersion = this.parseVersion(addon);
                    const hasChanges = remoteVersion && this.compareVersions(remoteVersion, localVersion);

                    resolve(new UpdaterNode(addon, raw, localVersion, remoteVersion, hasChanges));
                });

                res.on("error", rej);
            });
        });
    }

    static compareVersions(version1: string, version2: string) {
        // Very very lazy compare, I don't wanna bother with people versioning their addons like 1.   beta.aplha.24
        return version1 !== version2;
    }
}
