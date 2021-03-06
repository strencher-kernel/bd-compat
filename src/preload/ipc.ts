export const events = {};

const IPC = {
    on(event: string, callback: Function) {
        if (!events[event]) events[event] = new Set();

        return events[event].add(callback), IPC.off.bind(null, event, callback);
    },
    off(event: string, callback: Function) {
        if (!events[event]) return;

        events[event].delete(callback);

        if (!events[event].size) delete events[event];
    },
    once(event: string, callback: Function) {
        const unsubscribe = IPC.on(event, (...args) => {
            unsubscribe();
            return callback(...args);
        });
    },
    dispatch(event: string, ...args: any[]) {
        if (!events[event]) return;

        for (const callback of events[event]) {
            try {callback(...args);}
            catch (error) {console.error(error);}
        }
    }
};

export default IPC;