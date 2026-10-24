export declare class TreeWorkerClient {
    #private;
    worker: Worker;
    nextId: number;
    pending: Map<any, any>;
    ready: Promise<void>;
    /** @param {string | URL} [workerUrl] */
    constructor(workerUrl?: string | URL);
    setData(nodes: any): Promise<void>;
    search(query: any, options?: {}): Promise<any>;
    rebuildRows(options?: {}): Promise<any>;
    destroy(): void;
}
