import Logger from "../logger.js";

export default class EventEmitter {
    static get EventEmitter() {return EventEmitter;}

    constructor() {
        this.events = {};
    }

    setMaxListeners() {}

    on(event, callback) {
        if (!this.events[event]) this.events[event] = new Set();

        this.events[event].add(callback);
        return this;
    }

    emit(event, ...args) {
        if (!this.events[event]) return;

        for (const [index, listener] of this.events[event].entries()) {
            try {
                listener(...args);
            } catch (error) {
                Logger.error("Emitter", `Cannot fire listener for event ${event} at position ${index}:`, error);
            }
        }

        return this;
    }

    off(event, callback) {
        if (!this.events[event]) return;

        this.events[event].delete(callback);
        return this;
    }
};
