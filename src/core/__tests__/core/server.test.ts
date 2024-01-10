import type { LRUCache } from "lru-cache";
import type { Server } from "bun";
import { test, expect, describe, beforeAll } from "bun:test";
import { run } from "../../server"; // Export a function that creates the server
import { getFreeMemoryInBytes } from "../../utils/memory.util";
import { serialize } from "bun:jsc";
import { getCacheInstance, initCacheInstance } from "../../utils/cache.util";
import { compileRoute } from "../../utils/router.util";
import {
	ENCODINGS,
	compressResponse,
	convertToCacheableObject,
	getRequestId,
} from "../../utils/http.util";

describe("Server", async () => {
	let server: Server | undefined;
	let baseUrl: string | undefined;
	let cache: LRUCache<string, ResponseCacheableObject> | undefined;
	beforeAll(async () => {
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
		cache = getCacheInstance();
		/**
		 * Compiles raw routes into a format suitable for matching against incoming requests.
		 */
		const routes = compileRoute([
			{
				path: "/cache",
				handler: () => {
					return new Response("Hello, World!", {
						headers: {
							"content-type": "text/plain",
						},
					});
				},
			},
			{
				path: "/error",
				handler: () => {
					throw new Error("Simulated server error");
				},
			},
			{
				path: "/error-cache",
				handler: () => {
					throw new Error("Simulated server error on revalidation");
				},
			},
		]);

		// Server configuration and initialization
		const port = +(process.env.PORT || "3000") || 3000;
		const hostname = process.env.HOST || process.env.HOSTNAME || "localhost";

		/**
		 * Starts a Bun server with defined hostname and port. The server handles incoming HTTP requests
		 * and routes them based on the defined route handlers, while also handling CORS and caching.
		 */
		server = await run(routes, {
			cache,
			hostname,
			port,
			getRequestId,
		});

		baseUrl = `http://${server.hostname}:${server.port}`;
	});

	test("Server responds to favicon.ico request", async () => {
		if (!server) {
			throw new Error("Server not initialized");
		}
		// Simulate a request to favicon.ico
		const response = await server.fetch(
			new Request(new URL("/favicon.ico", baseUrl).toString()),
		);
		expect(response.status).toBe(404); // Assuming your server responds with 404 for favicon.ico
	});

	test("Server responds to OPTIONS request (CORS)", async () => {
		if (!server) {
			throw new Error("Server not initialized");
		}

		// Define a URL path for the OPTIONS request
		const testUrl = new URL("/test-cors", baseUrl).toString();

		// Simulate an OPTIONS request
		const response = await server.fetch(
			new Request(testUrl, {
				method: "OPTIONS",
				headers: {
					Origin: "http://example.com",
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "Content-Type",
				},
			}),
		);

		// Check the response status
		expect(response.status).toBe(204); // 204 No Content is common for OPTIONS responses

		// Check for specific CORS headers
		const headers = response.headers;
		expect(headers.get("Access-Control-Allow-Origin")).toBe("*"); // or a specific domain
		expect(headers.get("Access-Control-Allow-Methods")).toContain("POST");
		expect(headers.get("Access-Control-Allow-Headers")).toContain(
			"Content-Type",
		);
	});

	test("Server responds to health check", async () => {
		if (!server) {
			throw new Error("Server not initialized");
		}
		// Simulate a request to the health check endpoint
		const response = await server.fetch(
			new Request(new URL("/healthcheck", baseUrl).toString()),
		);

		// Check the response
		expect(response.status).toBe(200);
		// biome-ignore lint/suspicious/noExplicitAny: any is needed here
		const data = (await response.json()) as any;
		expect(data.success).toBe(true);
		expect(data.message).toBe("Health Check is good.");
	});

	test("Server handles requests to undefined routes", async () => {
		if (!server) {
			throw new Error("Server not initialized");
		}

		// Define a URL path that does not match any defined route
		const testUrl = new URL("/undefinedroute", baseUrl).toString();

		// Simulate a request to the undefined route
		const response = await server.fetch(new Request(testUrl));

		// Check the response status to be 404 Not Found
		expect(response.status).toBe(404);

		// Optionally, check the response body for a specific error message
		const responseBody = await response.text();
		expect(responseBody).toContain("Page not found!"); // or any specific message your server returns
	});

	test("Server works with staleWhileRevalidate", async () => {
		if (!server) {
			throw new Error("Server not initialized");
		}
		if (!cache) {
			throw new Error("Cache not initialized");
		}

		const staleText = "Hi Test";
		const freshText = "Hello, World!";
		const mockCacheableData = await convertToCacheableObject(
			new Response(staleText, {
				headers: {
					"content-type": "text/plain",
				},
			}),
		);
		const cacheUrl = new URL("/cache", baseUrl).toString();
		const mockRequest = new Request(cacheUrl);
		const requestId = getRequestId(mockRequest);
		cache.set(requestId, mockCacheableData);
		// Simulate a request to a non-existent endpoint
		const response = await server.fetch(new Request(cacheUrl));

		const responseText = await response.text();
		expect(responseText).toBe(staleText);

		// Hold for 100ms to allow for revalidation in bg
		await new Promise((r) => setTimeout(r, 100));

		const response2 = await server.fetch(new Request(cacheUrl));

		const responseText2 = await response2.text();
		expect(responseText2).toBe(freshText);
	});

	test("Server handles stale-while-revalidate correctly", async () => {
		if (!server || !cache) {
			throw new Error("Server or cache not initialized");
		}

		// Setup: Pre-populate the cache with stale data
		const staleResponse = new Response("Stale Content", {
			headers: { "Content-Type": "text/plain" },
		});
		const staleCacheObject = await convertToCacheableObject(staleResponse);
		const requestUrl = new URL("/cache", baseUrl).toString();
		const requestId = getRequestId(new Request(requestUrl));
		cache.set(requestId, staleCacheObject);

		// Step 1: Make a request to the server and expect stale content
		const firstResponse = await server.fetch(new Request(requestUrl));
		const firstResponseText = await firstResponse.text();
		expect(firstResponseText).toBe("Stale Content");

		// Step 2: Wait for a short duration to allow background revalidation to complete
		await new Promise((resolve) => setTimeout(resolve, 100)); // Adjust time as needed

		// Step 3: Make another request to the server and expect fresh content
		const freshResponse = await server.fetch(new Request(requestUrl));
		const freshResponseText = await freshResponse.text();
		expect(freshResponseText).toBe("Hello, World!"); // Assuming this is the fresh content

		// Optionally, verify that the cache has been updated with fresh content
		const updatedCacheObject = cache.get(requestId);

		const updatedResponse = new Response(updatedCacheObject?.body, {
			headers: new Headers(updatedCacheObject?.headers) as Headers,
			status: freshResponse.status,
		});
		// As brotli is not supported, we need to decompress the response
		const convertedResponseBody = await compressResponse(
			updatedResponse,
			ENCODINGS.IDENTITY,
		);
		const converedHeaders = new Headers(updatedResponse.headers);
		converedHeaders.set("content-encoding", ENCODINGS.IDENTITY);
		converedHeaders.set(
			"content-length",
			convertedResponseBody.length.toString(),
		);
		const response = new Response(convertedResponseBody, {
			headers: converedHeaders as Headers,
			status: updatedResponse.status,
		});
		const updatedResponseText = await response.text();
		expect(updatedResponseText).toBe("Hello, World!");
	});

	test("Server handles errors during request processing", async () => {
		if (!server) {
			throw new Error("Server not initialized");
		}

		// Define a URL for the error route
		const errorUrl = new URL("/error", baseUrl).toString();

		// Simulate a request to the error route
		const response = await server.fetch(new Request(errorUrl));

		// Check the response status and body for error handling
		expect(response.status).toBe(500); // Assuming your server responds with 500 for internal errors
		const responseBody = await response.text();
		expect(responseBody).toContain("Simulated server error"); // or any specific message your server returns
	});

	test("Server handles stale-while-revalidate with revalidation failure", async () => {
		if (!server || !cache) {
			throw new Error("Server or cache not initialized");
		}

		// Setup: Pre-populate the cache with initial success data
		const initialResponse = new Response("Initial Success", {
			headers: { "Content-Type": "text/plain" },
		});
		const initialCacheObject = await convertToCacheableObject(initialResponse);
		const errorCacheUrl = new URL("/error-cache", baseUrl).toString();
		const requestId = getRequestId(new Request(errorCacheUrl));
		cache.set(requestId, initialCacheObject);

		// Step 1: Make a request and expect initial success content
		const firstResponse = await server.fetch(new Request(errorCacheUrl));
		const firstResponseText = await firstResponse.text();
		expect(firstResponseText).toBe("Initial Success");

		// Step 2: Wait for a short duration to allow background revalidation to attempt and fail
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Step 3: Make another request and expect an error response
		const errorResponse = await server.fetch(new Request(errorCacheUrl));
		const errorResponseText = await errorResponse.text();
		expect(errorResponse.status).toBe(500); // Assuming 500 is the error response status
		expect(errorResponseText).toContain(
			"Simulated server error on revalidation",
		);
	});
});
