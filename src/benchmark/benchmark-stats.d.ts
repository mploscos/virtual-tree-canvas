export declare class BenchmarkStats {
    maxSamples: number;
    samples: {
        frameMs: never[];
        patchMs: never[];
        sceneMs: never[];
        renderMs: never[];
        inputLatencyMs: never[];
        searchMs: never[];
        filterMs: never[];
        workerMs: never[];
    };
    frameCount: number;
    patchCount: number;
    lastSecondAt: any;
    fps: number;
    patchesPerSecond: number;
    lastPatchesFrame: number;
    constructor({ maxSamples }?: {
        maxSamples?: number | undefined;
    });
    recordFrame({ now, frameMs, patchMs, sceneMs, renderMs, patchesFrame, inputLatencyMs }: {
        frameMs: any;
        inputLatencyMs?: number | undefined;
        now: any;
        patchMs?: number | undefined;
        patchesFrame?: number | undefined;
        renderMs: any;
        sceneMs: any;
    }): void;
    recordOperation(type: any, durationMs: any): void;
    snapshot(): {
        fps: number;
        patchesFrame: number;
        patchesPerSecond: number;
        frameMs: {
            avg: number;
            p50: any;
            p95: any;
            p99: any;
        };
        patchMs: {
            avg: number;
            p50: any;
            p95: any;
            p99: any;
        };
        sceneMs: {
            avg: number;
            p50: any;
            p95: any;
            p99: any;
        };
        renderMs: {
            avg: number;
            p50: any;
            p95: any;
            p99: any;
        };
        inputLatencyMs: {
            avg: number;
            p50: any;
            p95: any;
            p99: any;
        };
        searchMs: {
            avg: number;
            p50: any;
            p95: any;
            p99: any;
        };
        filterMs: {
            avg: number;
            p50: any;
            p95: any;
            p99: any;
        };
        workerMs: {
            avg: number;
            p50: any;
            p95: any;
            p99: any;
        };
        sampleCount: number;
        avgFrameMs: number;
        p95FrameMs: any;
        avgSceneMs: number;
        avgRenderMs: number;
        p95RenderMs: any;
        avgInputLatencyMs: number;
    };
}
