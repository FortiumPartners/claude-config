"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.noCompressionMiddleware = exports.highCompressionMiddleware = exports.compressionMiddleware = void 0;
const compression_1 = __importDefault(require("compression"));
const environment_1 = require("../config/environment");
const zlib_1 = require("zlib");
exports.compressionMiddleware = (0, compression_1.default)({
    level: environment_1.config.compression.level,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        const contentEncoding = res.getHeader('content-encoding');
        if (contentEncoding) {
            return false;
        }
        const contentType = res.getHeader('content-type');
        if (contentType) {
            const type = contentType.split(';')[0].toLowerCase();
            const noCompressTypes = [
                'image/',
                'video/',
                'audio/',
                'application/zip',
                'application/gzip',
                'application/x-gzip',
                'application/x-rar-compressed',
                'application/x-7z-compressed',
                'application/pdf',
            ];
            if (noCompressTypes.some(noCompress => type.startsWith(noCompress))) {
                return false;
            }
        }
        return compression_1.default.filter(req, res);
    },
    memLevel: 8,
    windowBits: 15,
    strategy: zlib_1.constants.Z_DEFAULT_STRATEGY,
    chunkSize: 1024,
});
exports.highCompressionMiddleware = (0, compression_1.default)({
    level: 9,
    threshold: 512,
    memLevel: 9,
    filter: compression_1.default.filter,
});
const noCompressionMiddleware = (req, res, next) => {
    req.headers['x-no-compression'] = 'true';
    next();
};
exports.noCompressionMiddleware = noCompressionMiddleware;
//# sourceMappingURL=compression.middleware.js.map