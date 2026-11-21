import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createAppServer } from './server/createAppServer.js';
import { createLogger } from './server/utils/logger.js';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const log = createLogger('universalcast-main');
async function initServer() {
    const ctx = createAppServer();
    try {
        await ctx.sfu.init();
    }
    catch (err) {
        log.warn('Eager SFU worker initialization deferred; HTTP server will still start and retry SFU init on demand', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        ctx.app.use(vite.middlewares);
    }
    else {
        const rootDist = path.resolve(__dirname, 'dist');
        const parentDist = path.resolve(__dirname, '..', 'dist');
        const distPath = rootDist.endsWith(`dist-server${path.sep}dist`) ? parentDist : rootDist;
        ctx.app.use(express.static(distPath));
        ctx.app.get('*', (_req, res) => {
            res.sendFile(path.resolve(distPath, 'index.html'));
        });
    }
    const PORT = Number(process.env.PORT) || 3000;
    ctx.httpServer.listen(PORT, '0.0.0.0', () => {
        log.info('UniversalCast signaling + SFU server running', { port: PORT, mode: isProduction ? 'production' : 'development' });
    });
    const handleShutdown = async () => {
        log.info('Shutting down UniversalCast server...');
        await ctx.shutdown();
        process.exit(0);
    };
    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
}
initServer().catch((err) => {
    log.error('Failed to start UniversalCast server', {
        error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
});
//# sourceMappingURL=server.js.map