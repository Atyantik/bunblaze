import {
	errorResponse,
	jsonResponse,
	notFoundResponse,
} from "./utils/response.util";
import {
	convertToCacheableObject,
	cacheResponseObject,
	convertCacheableObject,
	getRequestId as defaultGetRequestId,
	ENCODINGS,
} from "./utils/http.util";
import { findMatchedRoute } from "./utils/router.util";
import { corsConfig, setCORSHeaders } from "./utils/cors.util";
import { LRUCache } from "lru-cache";

/**
 * A set to keep track of ongoing background revalidation requests.
 */
const bgRequests = new Set<string>();

export const run = async (routes: CompiledRoute[], options?: {
  cache?: LRUCache<string, ResponseCacheableObject>,
  hostname?: string;
  port?: number;
  getRequestId?: (request: Request) => string;
}) => {
  const cache = options?.cache;
  const getRequestId = options?.getRequestId || defaultGetRequestId;
	/**
	 * Starts a Bun server with defined hostname and port. The server handles incoming HTTP requests
	 * and routes them based on the defined route handlers, while also handling CORS and caching.
	 */
	const server = Bun.serve({
    ...(options?.hostname ? { hostname: options.hostname } : {}),
    ...(options?.port ? { port: options.port } : {}),
		async fetch(request) {
			// Ignore requests for favicon.ico
			if (request.url.includes("/favicon.ico")) {
				return notFoundResponse();
			}

			/**
			 * Health Check should be defined before any request and needs does not
			 * need to be cached!
			 */
			if (request.url.includes("/healthcheck")) {
				return jsonResponse({
					success: true,
					message: "Health Check is good.",
				});
			}

			/**
			 * Enable cors for all requests
			 * @todo Add support for cors config per route and based on
			 * domains that we already have in the list
			 */
			if (corsConfig.enabled && request.method === "OPTIONS") {
				const headers = new Headers() as Headers;
				setCORSHeaders(headers);
				return new Response(null, { status: 204, headers });
			}

			// Find route based on request
			const r = findMatchedRoute(request, routes);
			if (!r?.route?.handler) {
				return notFoundResponse();
			}
			const requestId = getRequestId(request);

			// Acceptable encodings by the request
			const requestAcceptableEncodings = (
				request.headers.get("accept-encoding") || ENCODINGS.IDENTITY
			)
				.split(",")
				.map((t) => t.trim());

			const workWithCache =
        cache && 
				r.route?.cache &&
				["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
			try {
				let data: ResponseCacheableObject | undefined;
				// Only execute stale while revalidate if the route is cacheable
				if (workWithCache) {
					// Get the cached data
					data = cache.get(requestId) as ResponseCacheableObject | undefined;

					// If the cache data body is not empty, execute stale while revalidate
					if (data?.body?.length) {
						// Clone the request for background revalidation
						let clonedRequest: Request | null = request.clone();

						// Revalidate in background
						(async () => {
							try {
								// If a background request is in progress, don't revalidate
								if (bgRequests.has(requestId)) return;
								bgRequests.add(requestId);
								const routeData = await r.route.handler(
									clonedRequest,
									r.params,
								);
								let resObj = await convertToCacheableObject(routeData, [
									ENCODINGS.BROTLI,
								]);
								resObj = await cacheResponseObject(requestId, resObj);
							} catch (ex) {
								console.log(ex);
								// On error, it means two things here, either the handler failed,
								// or the caching failed. Either way, we need to remove the cache
								// to avoid serving stale data
								cache.delete(requestId);
							} finally {
								// Release the cloned request
								clonedRequest = null;
								bgRequests.delete(requestId);
							}
						})();

						const headers = new Headers(data.headers);
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
						data = await convertToCacheableObject(routeData, [
							ENCODINGS.BROTLI,
						]);
						data = await cacheResponseObject(requestId, data);
					} else {
						data = await convertToCacheableObject(
							routeData,
							requestAcceptableEncodings,
						);
					}
				}

				const responseHeaders = new Headers(data.headers);
				const responseEncoding =
					responseHeaders.get("content-encoding") || ENCODINGS.IDENTITY;
				if (!requestAcceptableEncodings.includes(responseEncoding)) {
					console.log(
						`Data found in ${responseEncoding} compression but requested in: ${requestAcceptableEncodings.join(
							",",
						)}`,
					);
					data = await convertCacheableObject(data, requestAcceptableEncodings);
				}

				if (!data?.body?.length) return notFoundResponse();

				const finalHeaders = new Headers(data.headers) as Headers;
				if (!finalHeaders.get("x-cache")) {
					finalHeaders.set("X-Cache", "MISS");
				}

				setCORSHeaders(finalHeaders);
				return new Response(data.body, {
					status: data.status,
					headers: finalHeaders,
				});
			} catch (ex) {
				const errorRes = errorResponse(ex);
				setCORSHeaders(errorRes.headers as Headers);
				errorRes.headers.set("X-Cache", "ERROR");
				return errorRes;
			}
		},
	});
	return server;
};
