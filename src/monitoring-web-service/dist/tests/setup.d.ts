declare global {
    namespace NodeJS {
        interface Global {
            delay: (ms: number) => Promise<void>;
        }
    }
    var delay: (ms: number) => Promise<void>;
}
export {};
//# sourceMappingURL=setup.d.ts.map