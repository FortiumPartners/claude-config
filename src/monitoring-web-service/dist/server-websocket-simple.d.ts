import { Server as SocketIOServer } from 'socket.io';
declare function startSimpleServer(): Promise<{
    app: import("express-serve-static-core").Express;
    io: SocketIOServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
    httpServer: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
}>;
export { startSimpleServer };
//# sourceMappingURL=server-websocket-simple.d.ts.map