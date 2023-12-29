import { hash } from "./hash.util";
import { requestMemoize } from "./memorize.util";
import { cache } from "./cache.util";
import {
	brotliCompress,
	brotliDecompress,
	canUseBrotli,
	deflateCompress,
	// deflateDecompress,
	gzipCompress,
	// gzipDecompress,
} from "./compress.util";
import { jsonResponse } from "./response.util";

export const ENCODINGS = {
	BROTLI: "br",
	GZIP: "gzip",
	DEFLATE: "deflate",
	IDENTITY: "identity",
};

export const getRequestId = requestMemoize((request: Request) => {
	const url = new URL(request.url);
	
	const requestEncodings =
		request.headers
			.get("accept-encoding")
			?.split(",")
			.map((e) => e.trim()) || [];

	// Define the order of preference for compression methods
	const preferredEncodings = [
		...(canUseBrotli ? [ENCODINGS.BROTLI] : []),
		ENCODINGS.GZIP,
		ENCODINGS.DEFLATE,
	];

	// Find the first supported encoding
	const selectedEncoding =
		preferredEncodings.find((enc) => requestEncodings.includes(enc)) ||
		ENCODINGS.IDENTITY;

	// Sort the search parameters by their keys
	url.search = new URLSearchParams(
		Array.from(url.searchParams).sort((a, b) => a[0].localeCompare(b[0])),
	).toString();

	// Construct the URL with sorted search parameters
	const exceptHost = url.pathname + (url.search ? `?${url.search}` : "") + selectedEncoding;
	const uniqueRequestKey = hash(exceptHost);

	return `req:${uniqueRequestKey}`;
});

/**
 * Provided a response, decompress it and return the string content
 * @param response Response
 * @returns Promise<string>
 */
const decompressResponse = async (response: Response): Promise<string> => {
	const contentEncoding = response.headers.get("content-encoding");

	/**
	 * As bun does not support BR by default we will need to decompress it manually
	 */
	if (contentEncoding === "br") {
		const arrayBuffer = await response.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);
		return brotliDecompress(uint8Array);
	}
	return await response.text();
};

/**
 * Compress data using the specified encoding
 * @param data String or Uint8Array
 * @param encoding (br, gzip, deflate, identity)
 * @returns Promise<Uint8Array>
 */
const compressData = async (
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

async function handleResponseCompression(
	request: Request,
	response: Response,
): Promise<{ compressedData: Uint8Array; dataEncoding: string }> {
	const responseEncoding = response.headers.get("content-encoding") || "";
	const requestEncodings =
		request.headers
			.get("accept-encoding")
			?.split(",")
			.map((e) => e.trim()) || [];


	// Define the order of preference for compression methods
	const preferredEncodings = [
		...(canUseBrotli ? [ENCODINGS.BROTLI] : []),
		ENCODINGS.GZIP,
		ENCODINGS.DEFLATE,
	];

	// Find the first supported encoding
	const selectedEncoding =
		preferredEncodings.find((enc) => requestEncodings.includes(enc)) ||
		ENCODINGS.IDENTITY;

	let compressedData: Uint8Array;
	let dataEncoding: string = ENCODINGS.IDENTITY;

	// If the response encoding is different from the selected encoding, decompress and recompress
	if (selectedEncoding !== responseEncoding) {
		const decompressedData = await decompressResponse(response);

		// Use selectedEncoding for compression, if it's not 'identity'
		if (selectedEncoding !== ENCODINGS.IDENTITY) {
			compressedData = await compressData(decompressedData, selectedEncoding);
			dataEncoding = selectedEncoding;
		} else {
			compressedData = new Uint8Array(Buffer.from(decompressedData)); // No re-compression
		}
	} else {
		// If the response is already in the desired encoding, use it as is
		compressedData = new Uint8Array(await response.arrayBuffer());
		dataEncoding = responseEncoding;
	}

	return { compressedData, dataEncoding };
}

async function handleStringCompression(
	request: Request,
	data: string,
): Promise<{ compressedData: Uint8Array; dataEncoding: string }> {
	const requestEncodings =
		request.headers
			.get("accept-encoding")
			?.split(",")
			.map((e) => e.trim()) || [];
	const preferredEncodings = [
		...(canUseBrotli ? [ENCODINGS.BROTLI] : []),
		ENCODINGS.GZIP,
		ENCODINGS.DEFLATE,
	];

	const selectedEncoding =
		preferredEncodings.find((enc) => requestEncodings.includes(enc)) ||
		ENCODINGS.IDENTITY;
	let compressedData: Uint8Array;
	const headers = new Headers();

	if (selectedEncoding !== ENCODINGS.IDENTITY) {
		compressedData = await compressData(data, selectedEncoding);
	} else {
		const encoder = new TextEncoder();
		compressedData = encoder.encode(data);
	}

	headers.set("content-length", compressedData.length.toString());
	return { compressedData, dataEncoding: selectedEncoding, };
}

export const compressAndCacheResponse = async (
	request: Request,
	data?: JsonValue | Response,
	options?: {
		cache?: boolean;
	},
) => {
	const shouldCache =
		options?.cache &&
		["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());

	const requestId = getRequestId(request);

	if (data instanceof Response) {
		const { compressedData, dataEncoding } = await handleResponseCompression(
			request,
			data,
		);
		const responseHeaders = new Headers(data.headers);
		responseHeaders.set("content-encoding", dataEncoding);
		responseHeaders.set("content-length", compressedData.length.toString());
		
		if (shouldCache) {
			responseHeaders.set("X-Cache-Date", new Date().toISOString());
			cache.set(requestId, {
				body: compressedData,
				status: data.status,
				headers: Array.from(responseHeaders.entries()),
			});
		}

		return new Response(compressedData, {
			status: data.status,
			headers: responseHeaders,
		});
	}
	const stringData = JSON.stringify(data);
	const { compressedData, dataEncoding } = await handleStringCompression(request, stringData);

	const responseHeaders = new Headers();
	responseHeaders.set("content-encoding", dataEncoding);
	responseHeaders.set("content-length", compressedData.length.toString());

	if (shouldCache) {
		responseHeaders.set("X-Cache-Date", new Date().toISOString());
		cache.set(requestId, {
			body: compressedData,
			status: 200,
			headers: Array.from(responseHeaders.entries()),
		});
	}

	return jsonResponse(compressedData, 200, responseHeaders);
};
