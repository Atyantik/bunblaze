import {
	errorResponse,
	jsonResponse,
	notFoundResponse,
} from "./utils/response.util";
import { cache } from "./utils/cache.util";
import {
	compressToResponseObject,
	cacheResponseObject,
	convertFromBrotliResponseObject,
	getRequestId,
  ENCODINGS,
} from "./utils/request.util";
import { findMatchedRoute, compileRoute } from "./utils/router.util";
import { routes as rawRoutes } from "./__routes";

/**
 * Compile the routes
 */
const routes = compileRoute(rawRoutes);
const bgRequests = new Set<string>();

const port = +(process.env.PORT || "3000") || 3000;
const hostname = process.env.HOST || process.env.HOSTNAME || "localhost";

const server = Bun.serve({
	hostname,
	port,
	async fetch(request) {
		// Ignore requests for favicon.ico
		if (request.url.includes("/favicon.ico")) {
			return notFoundResponse();
		}
		const r = findMatchedRoute(request, routes);
		if (!r?.route?.handler) {
			return notFoundResponse();
		}
		const requestId = getRequestId(request);
		const workWithCache =
			r.route?.cache &&
			["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
		try {
			let data: ResponseObject | undefined;
			let headers: Headers | undefined;
			// Only execute stale while revalidate if the route is cacheable
			if (workWithCache) {
				// Get the cached data
				data = cache.get(requestId) as ResponseObject | undefined;

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
							const routeData = await r.route.handler(clonedRequest, r.params);
							let resObj = await compressToResponseObject(
								clonedRequest,
								routeData,
                ENCODINGS.BROTLI,
							);
							resObj = await cacheResponseObject(clonedRequest, resObj);
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

					headers = new Headers(data.headers);
					headers.set("X-Cache", "HIT");
					data.headers = Array.from(headers.entries());
				} else {
					data = undefined;
				}
			}
      // If there is no cached data, execute the handler
      if (!data) {
        const routeData = await r.route.handler(request, r.params);
        if (workWithCache) {
          data = await compressToResponseObject(request, routeData, ENCODINGS.BROTLI);
          data = await cacheResponseObject(request, data);
        } else {
          data = await compressToResponseObject(request, routeData);
        }
      }

      const responseHeaders = new Headers(data.headers);
      const requestEncoding = request.headers.get('accept-encoding') || ENCODINGS.IDENTITY;
      const responseEncoding = responseHeaders.get('content-encoding') || ENCODINGS.IDENTITY;
      if (!requestEncoding.includes(responseEncoding)) {
				console.log(`Cache stored in brotli but requested in: ${requestEncoding}`);
        data = await convertFromBrotliResponseObject(data, requestEncoding);
      }

			if (!data?.body?.length) return notFoundResponse();

			const finalHeaders = new Headers(data.headers);
			if (!finalHeaders.get('x-cache')) {
				finalHeaders.set("X-Cache", "MISS");
			}

			return new Response(
				data.body,
				{
					status: data.status,
					headers: finalHeaders,
				},
			);
		} catch (ex) {
			const errorRes = errorResponse(ex);
			errorRes.headers.set("X-Cache", "ERROR");
			return errorRes;
		}
	},
});

console.log(`Listening on ${server.hostname}:${server.port}`);
