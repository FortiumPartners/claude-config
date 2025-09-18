# AGENTS.md - Claude Config Development Guidelines

## Build/Test Commands

- **Root**: `npm test` (mocha), `npm run test:watch`, `npm start`, `npm run dev`
- **Hooks**: `npm run build` (TypeScript), `npm test` (jest), `npm run dev` (tsx watch)
- **Web Service**: `npm run build`, `npm test`, `npm run test:unit`, `npm run test:integration`, `npm run lint`, `npm run format`
- **Single Test**: `jest path/to/test.js` or `mocha test/specific.test.js`
- **Python**: Use `uv` for dependency management, requires Python >=3.13

## Code Style Guidelines

- **TypeScript**: Strict types, no `any` (warn only), unused vars with `^_` prefix allowed
- **Prettier**: 2 spaces, single quotes, 100 char width, trailing commas, semicolons
- **ESLint**: Extends recommended + TypeScript, prefer `const`, no `var`
- **Imports**: Group by type (external, internal, relative), use absolute paths when possible
- **Naming**: camelCase for variables/functions, PascalCase for classes, UPPER_SNAKE for constants
- **Error Handling**: Use try/catch, proper error types, meaningful messages
- **Documentation**: JSDoc for public APIs, inline comments for complex logic only
- **Performance**: Target ≤50ms execution, ≤32MB memory for hooks/analytics

## Architecture Patterns

- **Node.js**: Event-driven with EventEmitter, async/await preferred over callbacks
- **Express**: Middleware chain pattern, proper error handling, security-first
- **File Structure**: Separate concerns (middleware/, config/, services/), index files for exports

read @CLAUDE.md
