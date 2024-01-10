import { getCacheInstance } from "./cache.util";
import {
	ENCODINGS,
	convertCacheableObject,
	convertToCacheableObject,
	cacheResponseObject,
	getUrlId,
} from "./http.util";

/**
 * Type definition for the response data. It is an alias for the standard Response type.
 */
type ResponseData = Response;

/**
 * Fetches a resource with stale-while-revalidate caching strategy. 
 * If the resource is cached, it returns the cached version and asynchronously revalidates the cache.
 * Otherwise, it fetches the resource from the network and caches it.
 * 
 * @param {string} uniqueKey - A unique identifier for the site or resource being fetched.
 * @param {string} url - The URL of the resource to fetch.
 * @param {RequestInit} [requestOptions] - Optional fetch options.
 * @returns {Promise<ResponseData>} A promise that resolves to the response data.
 */
export async function fetchStale(
	uniqueKey: string,
	url: string,
	requestOptions?: RequestInit,
	staleOptions?: {
		revalidate?: boolean;
	}
): Promise<ResponseData> {

	const shouldRevalidate = Boolean(staleOptions?.revalidate ?? true);
	// Define a unique cache key, e.g., based on the URL
	const cacheKey = `fetchStale:${getUrlId(url, uniqueKey)}`;

	// Get cached data in brotli/gzip compression from the cache
	const cache = getCacheInstance();
	const cachedData = cache.get(cacheKey);
	// If found the cachedData, trigger a background revalidation
	// Decompress the data, and return it as bun does not support
	// Decompressing brotli, we need to do it ourself
	if (cachedData?.body?.length) {
		// Convert to identity encoding for the function
		// to be able to decompress it faster as it is going to do it in background anyway
		if (shouldRevalidate) {
			revalidateInBackground(url, requestOptions, cacheKey);
		}
		const cde = await convertCacheableObject(cachedData, [ENCODINGS.IDENTITY]);
		const cachedHeaders = new Headers(cde.headers) as Headers;
		return new Response(cde.body, {
			status: cde.status,
			headers: cachedHeaders,
		});
	}

	const response = await fetch(url, requestOptions);
	if (response.ok && shouldRevalidate) {
		revalidateInBackground(url, requestOptions, cacheKey);
	}
	return response;
}

/**
 * A set to track ongoing background revalidation requests. This prevents multiple revalidations for the same resource.
 */
const bgRequests = new Set<string>();

/**
 * Performs an asynchronous revalidation of a resource. This function is intended to be used in the background to update the cache.
 * It only revalidates for GET, HEAD, or OPTIONS requests and ensures that only one revalidation occurs at a time for a given resource.
 * 
 * @param {string} url - The URL of the resource to revalidate.
 * @param {RequestInit | undefined} options - The options for the fetch request used in revalidation.
 * @param {string} cacheKey - The cache key associated with the resource.
 */
async function revalidateInBackground(
	url: string,
	options: RequestInit | undefined,
	cacheKey: string,
) {
	if (
		!["GET", "HEAD", "OPTIONS"].includes(
			(options?.method ?? "GET").toUpperCase(),
		)
	) {
		return;
	}
	if (bgRequests.has(cacheKey)) {
		// A revalidation is already in progress for this key
		return;
	}

	bgRequests.add(cacheKey);
	try {
		const headers = new Headers(options?.headers ?? {});
		headers.set("accept-encoding", "br, gzip, deflate");
		const response = await fetch(url, {
			...options,
			headers,
		});
		const cacheableObject = await convertToCacheableObject(
			response,
			Object.values(ENCODINGS),
		);
		await cacheResponseObject(cacheKey, cacheableObject);
	} catch (error) {
		console.error(`Error during revalidation for ${url}:`, error);
	} finally {
		bgRequests.delete(cacheKey);
	}
}
