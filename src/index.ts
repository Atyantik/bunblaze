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
    // Ignore requests for favicon.ico
    if (request.url.includes('/favicon.ico')) {
      return notFoundResponse();
    }
    const r = findMatchedRoute(request, routes);
    if (!r) {
      return notFoundResponse();
    }
    const requestId = getRequestId(request);
    try {
      // Only execute stale while revalidate if the route is cacheable
      if (r.route.cache) {
        // Get the cached data
        const data = cache.get(requestId) as CachedResponse | undefined;
        // If the cache data body is not empty, execute stale while revalidate
        if (data?.body?.length) {
          // Clone the request for background revalidation
          let clonedRequest: Request | null = request.clone();

          // Revalidate in background
          (async () => {
            // If a background request is in progress, don't revalidate
            if (bgRequests.has(requestId)) return;
            bgRequests.add(requestId);
            try {
              const newData = await r.route.handler(clonedRequest, r.params);
              await compressAndCacheResponse(clonedRequest, newData, { cache: r.route.cache });
            } catch (ex) {
              // On error, it means two things here, either the handler failed,
              // or the caching failed. Either way, we need to remove the cache
              // to avoid serving stale data
              cache.delete(requestId);
            }
            // Release the cloned request
            clonedRequest = null;
            bgRequests.delete(requestId);
          })();
  
          const cachedResponseHeaders = new Headers(data.headers);
          cachedResponseHeaders.set('X-Cache', 'HIT');
          return jsonResponse(
            data.body,
            data.status,
            cachedResponseHeaders,
          );
        }
      }
      const routeData = await r.route.handler(request, r.params);
      if (!routeData) {
        return notFoundResponse();
      }
      const response = await compressAndCacheResponse(request, routeData, {
        cache: r.route.cache,
      });
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
