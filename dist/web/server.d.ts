/**
 * Web server for cpulse dashboard.
 * Provides briefing history browser, analytics, and configuration editor.
 *
 * Created: 2026-01-12
 */
export interface WebServerOptions {
    port?: number;
    host?: string;
}
export declare function createWebServer(options?: WebServerOptions): {
    app: import("express-serve-static-core").Express;
    start: () => Promise<void>;
    port: number;
    host: string;
};
//# sourceMappingURL=server.d.ts.map