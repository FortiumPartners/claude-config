import { Server as SocketIOServer } from 'socket.io';
declare function startServer(): Promise<{
    app: import("express").Express;
    io: SocketIOServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
    httpServer: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
}>;
export { startServer };
//# sourceMappingURL=server-websocket.d.ts.map