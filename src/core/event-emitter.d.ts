export declare class EventEmitter {
    listeners: Map<any, any>;
    constructor();
    on(type: any, listener: any): () => void;
    off(type: any, listener: any): void;
    emit(type: any, detail?: {}): void;
}
