import {
	getRequestId,
} from "./core/utils/http.util";
import { compileRoute } from "./core/utils/router.util";
import { routes as rawRoutes } from "./__routes";
import { run } from "./core/server";
import { getCacheInstance, initCacheInstance } from "./core/utils/cache.util";
import { getFreeMemoryInBytes } from "./core/utils/memory.util";
import { serialize } from "bun:jsc";

/**
 * Performs garbage collection and calculates the usable bytes for the cache based on the system's available memory.
 */
Bun.gc(true);
const availableBytes = await getFreeMemoryInBytes();
// 70% of memory
const usableBytes = Math.floor(availableBytes * 0.7);

/**
 * Calculates the size of an object in bytes. This is used in the cache's size calculation logic.
 * 
 * @param {ResponseCacheableObject} obj - The object whose size needs to be calculated.
 * @returns {number} The size of the object in bytes.
 */
function sizeOf(obj: ResponseCacheableObject): number {
	const serializedObj = serialize(obj);
	return serializedObj.byteLength + 50;
}

/**
 * Configuration options for the LRUCache. It includes settings for 
 * maximum cache size, size calculation method, and stale item handling.
 */
const options = {
	maxSize: usableBytes,
	sizeCalculation: sizeOf,

	// return stale items before removing from cache?
	allowStale: true,
};

await initCacheInstance(options);
const cache = getCacheInstance();
/**
 * Compiles raw routes into a format suitable for matching against incoming requests.
 */
const routes = compileRoute(rawRoutes);

// Server configuration and initialization
const port = +(process.env.PORT || "3000") || 3000;
const hostname = process.env.HOST || process.env.HOSTNAME || "localhost";

/**
 * Starts a Bun server with defined hostname and port. The server handles incoming HTTP requests
 * and routes them based on the defined route handlers, while also handling CORS and caching.
 */
const server = await run(routes, {
	cache,
	hostname,
	port,
	getRequestId,
});

console.log(`Listening on ${server.hostname}:${server.port}`);
