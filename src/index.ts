import {
  errorResponse,
  jsonResponse,
  notFoundResponse,
} from "./utils/response.util";
import { cache } from "./utils/cache.util";
import { compressAndCacheResponse, getRequestId } from "./utils/request.util";
import { findMatchedRoute, compileRoute } from "./utils/router.util";
import { routes as rawRoutes } from "./__routes";

/**
 * Compile the routes
 */
const routes = compileRoute(rawRoutes);
const bgRequests = new Set<string>();

const port = +(process.env.PORT || '3000') || 3000;
const hostname = process.env.HOST || process.env.HOSTNAME || 'localhost';

const server = Bun.serve({
  hostname,
  port,
  async fetch(request) {
    const r = findMatchedRoute(request, routes);
    const requestId = getRequestId(request);
    if (request.url.includes('/favicon.ico')) {
      return notFoundResponse();
    }
    try {
      const data = cache.get(requestId) as CachedResponse | undefined;
      // If the cache data body is not empty, execute stale while revalidate
      if (data?.body?.length) {
        let clonedRequest: Request | null = request.clone();
        // Revalidate in background
        (async () => {
          // If a background request is in progress, don't revalidate
          if (bgRequests.has(requestId)) return;
          bgRequests.add(requestId);
          try {
            const newData = await r?.route?.handler?.(clonedRequest, r?.params);
            await compressAndCacheResponse(clonedRequest, newData, { brotli: true });
          } catch (ex) {
            // On error do not do anything, do not cache the response!
          }
          // Release the cloned request
          clonedRequest = null;
          bgRequests.delete(requestId);
        })();

        console.log('data.headers', data.headers);
        const cachedResponseHeaders = new Headers(data.headers);
        cachedResponseHeaders.set('X-Cache', 'HIT');
        return jsonResponse(
          data.body,
          data.status,
          cachedResponseHeaders,
        );
      }
      const routeData = await r?.route?.handler?.(request, r?.params);
      if (!routeData) {
        return notFoundResponse();
      }
      const response = await compressAndCacheResponse(request, routeData, {
        brotli: false,
      });
      // Compress with brotli and cache
      compressAndCacheResponse(request, routeData, { brotli: true });
      response.headers.set('X-Cache', 'MISS');
      return response;
    } catch (ex) {
      const errorRes = errorResponse(ex);
      errorRes.headers.set('X-Cache', 'ERROR')
      return errorRes;
    }
  },
});

console.log(`Listening on ${server.hostname}:${server.port}`);
