import { hash } from "./hash.util";
import { requestMemoize } from "./memoize.util";
import { getCacheInstance } from "./cache.util";
import {
	brotliCompress,
	brotliDecompress,
	canUseBrotli,
	deflateCompress,
	deflateDecompress,
	gzipCompress,
	gzipDecompress,
} from "./compress.util";

export const ENCODINGS = {
	BROTLI: "br",
	GZIP: "gzip",
	DEFLATE: "deflate",
	IDENTITY: "identity",
};
/**
 * Generates a unique ID for a given HTTP request. This ID is based on a 
 * hash of the request's URL with sorted search parameters and an optional 
 * unique header value.
 *
 * @param {Request} request - The HTTP request object.
 * @returns {string} A unique request ID.
 */
export const getRequestId = requestMemoize((request: Request) => {
	const url = new URL(request.url);

	// Sort the search parameters by their keys
	url.search = new URLSearchParams(
		Array.from(url.searchParams).sort((a, b) => a[0].localeCompare(b[0])),
	).toString();

	const uniqueId = request.headers.get("x-unique-id") || "";

	// Construct the URL with sorted search parameters
	const exceptHost =
		url.pathname + (url.search ? url.search : "") + uniqueId;

	const uniqueRequestKey = hash(exceptHost);

	return `req:${uniqueRequestKey}`;
});

/**
 * Decompresses the content of an HTTP response. It supports 'br'
 * (Brotli) encoding, falling back to plain text if Brotli is not applicable.
 * 
 * @param {Response} response - The HTTP response object to decompress.
 * @returns {Promise<string>} A promise that resolves to the decompressed response content as a string.
 */
export const decompressResponse = async (response: Response): Promise<string> => {
	const contentEncoding = response.headers.get("content-encoding");

	/**
	 * As bun does not support BR by default we will need to decompress it manually
	 */
	if (contentEncoding === "br") {
		const arrayBuffer = await response.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);
		return brotliDecompress(uint8Array);
	}
	return response.text();
};

/**
 * Compresses data using a specified encoding. Supports 'br' (Brotli), 
 * 'gzip', and 'deflate' encodings. For 'identity' encoding, it returns 
 * the original data.
 * 
 * @param {Uint8Array | string} data - The data to compress, either as a string or Uint8Array.
 * @param {string} encoding - The compression encoding to use.
 * @returns {Promise<Uint8Array>} A promise that resolves to the compressed data as a Uint8Array.
 */
export const compressData = async (
	data: Uint8Array | string,
	encoding: string,
): Promise<Uint8Array> => {
	switch (encoding) {
		case ENCODINGS.BROTLI:
			return brotliCompress(data);
		case ENCODINGS.GZIP:
			return gzipCompress(data);
		case ENCODINGS.DEFLATE:
			return deflateCompress(data);
		default:
			return typeof data === "string" ? new TextEncoder().encode(data) : data;
	}
};

/**
 * Compresses the content of an HTTP response using a specified encoding.
 * It first decompresses the response (if needed) and then recompresses it.
 * 
 * @param {Response} response - The HTTP response object to compress.
 * @param {string} [dataEncoding='br'] - The encoding to use for compression (default is Brotli).
 * @returns {Promise<Uint8Array>} A promise that resolves to the compressed response content.
 */
export async function compressResponse(
	response: Response,
	dataEncoding: string = ENCODINGS.BROTLI,
): Promise<Uint8Array> {
	const decompressedData = await decompressResponse(response);
	const compressedData = await compressData(decompressedData, dataEncoding);
	return compressedData;
}

/**
 * Compresses a string using a specified encoding.
 * 
 * @param {string} data - The string data to compress.
 * @param {string} [dataEncoding='br'] - The encoding to use for compression (default is Brotli).
 * @returns {Promise<Uint8Array>} A promise that resolves to the compressed data as a Uint8Array.
 */
export async function compressString(
	data: string,
	dataEncoding: string = ENCODINGS.BROTLI,
): Promise<Uint8Array> {
	const compressedData = await compressData(data, dataEncoding);
	return compressedData;
}

/**
 * Converts data or an HTTP response into a cacheable object. It compresses 
 * the data and sets appropriate response headers.
 * 
 * @param {JsonValue | Response} [data] - The data or HTTP response to convert.
 * @param {string[]} [acceptableEncodings=['br', 'gzip', 'deflate']] - An array of acceptable encodings for compression.
 * @returns {Promise<ResponseCacheableObject>} A promise that resolves to the cacheable response object.
 * @throws {Error} Throws an error if no acceptable encodings are provided.
 */
export const convertToCacheableObject = async (
	data?: JsonValue | Response,
	acceptableEncodings = [ENCODINGS.BROTLI, ENCODINGS.GZIP, ENCODINGS.DEFLATE],
): Promise<ResponseCacheableObject> => {
	if (!acceptableEncodings || !acceptableEncodings.length) {
		throw new Error("Please provide array of acceptable encodings");
	}

	// Define the order of preference for compression methods
	const preferredEncodings = [
		...(canUseBrotli ? [ENCODINGS.BROTLI] : []),
		ENCODINGS.GZIP,
		ENCODINGS.DEFLATE,
		ENCODINGS.IDENTITY,
	];

	// Find the first supported encoding
	const dataEncoding =
		preferredEncodings.find((enc) => acceptableEncodings.includes(enc)) ||
		ENCODINGS.IDENTITY;

	let compressedData: Uint8Array;
	let responseHeaders: Headers;
	let status: number;

	if (data instanceof Response) {
		compressedData = await compressResponse(data, dataEncoding);
		responseHeaders = new Headers(data.headers) as Headers;
		status = data.status;
	} else {
		const stringData = JSON.stringify(data);
		compressedData = await compressString(stringData, dataEncoding);
		responseHeaders = new Headers() as Headers;
		/**
		 * Not sure about application/json!
		 */
		responseHeaders.set("content-type", "application/json");
		status = 200;
	}
	responseHeaders.set("content-encoding", dataEncoding);
	responseHeaders.set("content-length", compressedData.length.toString());
	return {
		body: compressedData,
		status,
		headers: Array.from(responseHeaders.entries()),
	};
};

/**
 * Caches a response object with a unique request ID and updates the
 * 'x-cache-date' header to the current time.
 * 
 * @param {string} requestId - The unique request ID associated with the response object.
 * @param {ResponseCacheableObject} responseObj - The response object to cache.
 * @returns {Promise<ResponseCacheableObject>} A promise that resolves to the updated response object.
 */
export const cacheResponseObject = async (
	requestId: string,
	responseObj: ResponseCacheableObject,
): Promise<ResponseCacheableObject> => {
	// Set cache-date header
	const headers = new Headers(responseObj.headers);
	headers.set("x-cache-date", new Date().toISOString());
	responseObj.headers = Array.from(headers.entries());

	const cache = getCacheInstance();
	cache.set(requestId, responseObj);
	return responseObj;
};

/**
 * Converts a cached response object to match a set of acceptable encodings,
 * re-compressing the content if necessary.
 * 
 * @param {ResponseCacheableObject} cacheableObj - The cached response object to convert.
 * @param {string[]} acceptableEncodings - An array of acceptable content encodings.
 * @returns {Promise<ResponseCacheableObject>} A promise that resolves to the converted response object.
 * @throws {Error} Throws an error if no expected encoding is found or no acceptable encodings are provided.
 */
export const convertCacheableObject = async (
	cacheableObj: ResponseCacheableObject,
	acceptableEncodings: string[],
): Promise<ResponseCacheableObject> => {
	const newResponseObj: ResponseCacheableObject = {
		body: new Uint8Array(),
		status: cacheableObj.status,
		headers: cacheableObj.headers,
	};
	const headers = new Headers(cacheableObj.headers);
	const currentEncoding = headers.get("content-encoding");

	if (!acceptableEncodings || !acceptableEncodings.length) {
		throw new Error("Please provide array of acceptable encodings");
	}

	// Define the order of preference for compression methods
	const preferredEncodings = [
		...(canUseBrotli ? [ENCODINGS.BROTLI] : []),
		ENCODINGS.GZIP,
		ENCODINGS.DEFLATE,
		ENCODINGS.IDENTITY,
	];

	// Find the first supported encoding
	const expectedEncoding =
		preferredEncodings.find((enc) => acceptableEncodings.includes(enc)) ||
		ENCODINGS.IDENTITY;

	if (currentEncoding === expectedEncoding) return cacheableObj;

	let decompressedData: string;
	if (currentEncoding === ENCODINGS.BROTLI) {
		decompressedData = await brotliDecompress(cacheableObj.body);
	} else if (currentEncoding === ENCODINGS.GZIP) {
		decompressedData = await gzipDecompress(cacheableObj.body);
	} else if (currentEncoding === ENCODINGS.DEFLATE) {
		decompressedData = await deflateDecompress(cacheableObj.body);
	} else {
		decompressedData = new TextDecoder().decode(cacheableObj.body);
	}

	let convertedCompressedData: Uint8Array = new Uint8Array();
	switch (expectedEncoding) {
		case ENCODINGS.BROTLI:
			convertedCompressedData = await brotliCompress(decompressedData);
			break;
		case ENCODINGS.GZIP:
			convertedCompressedData = await gzipCompress(decompressedData);
			break;
		case ENCODINGS.DEFLATE:
			convertedCompressedData = await deflateCompress(decompressedData);
			break;
		case ENCODINGS.IDENTITY:
			convertedCompressedData = new Uint8Array(Buffer.from(decompressedData));
			break;
	}
	if (!convertedCompressedData.length) {
		throw new Error("No expected encoding found");
	}
	newResponseObj.body = convertedCompressedData;
	const newResponseObjHeaders = new Headers(cacheableObj.headers);
	newResponseObjHeaders.set("content-encoding", expectedEncoding);
	newResponseObjHeaders.set(
		"content-length",
		convertedCompressedData.length.toString(),
	);
	newResponseObj.headers = Array.from(newResponseObjHeaders.entries());
	return newResponseObj;
};
