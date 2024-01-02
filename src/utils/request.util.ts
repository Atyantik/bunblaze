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

export const ENCODINGS = {
	BROTLI: "br",
	GZIP: "gzip",
	DEFLATE: "deflate",
	IDENTITY: "identity",
};

export const getRequestId = requestMemoize((request: Request) => {
	const url = new URL(request.url);

	// Sort the search parameters by their keys
	url.search = new URLSearchParams(
		Array.from(url.searchParams).sort((a, b) => a[0].localeCompare(b[0])),
	).toString();

	// Construct the URL with sorted search parameters
	const exceptHost =
		url.pathname + (url.search ? `?${url.search}` : "");
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
	response: Response,
	dataEncoding: string = ENCODINGS.BROTLI,
): Promise<{ compressedData: Uint8Array; dataEncoding: string }> {
	const decompressedData = await decompressResponse(response);
	const compressedData = await compressData(decompressedData, dataEncoding);

	return { compressedData, dataEncoding };
}

async function handleStringCompression(
	data: string,
	dataEncoding: string = ENCODINGS.BROTLI,
): Promise<{ compressedData: Uint8Array; dataEncoding: string }> {
	const compressedData = await compressData(data, dataEncoding);
	return { compressedData, dataEncoding };
}

export const compressToResponseObject = async (
	request: Request,
	data?: JsonValue | Response,
	encoding = "",
): Promise<ResponseObject> => {
	let dataEncoding = encoding;
	if (!dataEncoding) {
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
		dataEncoding =
			preferredEncodings.find((enc) => requestEncodings.includes(enc)) ||
			ENCODINGS.IDENTITY;
	}

	let compressedData: Uint8Array;
	let responseHeaders: Headers;
	let status: number;

	if (data instanceof Response) {
		const cde = await handleResponseCompression(data, dataEncoding);
		compressedData = cde.compressedData;
		dataEncoding = cde.dataEncoding;
		responseHeaders = new Headers(data.headers);
		status = data.status;
	} else {
		const stringData = JSON.stringify(data);
		const cde = await handleStringCompression(stringData, dataEncoding);
		compressedData = cde.compressedData;
		dataEncoding = cde.dataEncoding;
		responseHeaders = new Headers();
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

export const cacheResponseObject = async (
	request: Request,
	responseObj: ResponseObject,
): Promise<ResponseObject> => {
	const requestId = getRequestId(request);

	// Set cache-date header
	const headers = new Headers(responseObj.headers);
	headers.set("x-cache-date", new Date().toISOString());
	responseObj.headers = Array.from(headers.entries());

	cache.set(requestId, responseObj);
	return responseObj;
};

export const convertFromBrotliResponseObject = async (
	responseObj: ResponseObject,
	expectedEncoding: string,
): Promise<ResponseObject> => {
	const newResponseObj: ResponseObject = {
		body: new Uint8Array(),
		status: responseObj.status,
		headers: responseObj.headers,
	};
	const headers = new Headers(responseObj.headers);
	const currentEncoding = headers.get("content-encoding");
	if (currentEncoding === expectedEncoding) return responseObj;
	const decompressedData = await brotliDecompress(responseObj.body);
	const newEncodingHeaders = new Headers(newResponseObj.headers);
	switch (expectedEncoding) {
		case ENCODINGS.GZIP:
			newResponseObj.body = await gzipCompress(decompressedData);
			newEncodingHeaders.set("content-encoding", ENCODINGS.GZIP);
			newEncodingHeaders.set(
				"content-length",
				newResponseObj.body.length.toString(),
			);
			break;
		case ENCODINGS.DEFLATE:
			newResponseObj.body = await deflateCompress(decompressedData);
			newEncodingHeaders.set("content-encoding", ENCODINGS.DEFLATE);
			newEncodingHeaders.set(
				"content-length",
				newResponseObj.body.length.toString(),
			);
			break;
		default:
			newResponseObj.body = new Uint8Array(Buffer.from(decompressedData));
			newEncodingHeaders.set("content-encoding", ENCODINGS.IDENTITY);
			newEncodingHeaders.set(
				"content-length",
				newResponseObj.body.length.toString(),
			);
			break;
	}
	newResponseObj.headers = Array.from(newEncodingHeaders.entries());
	return newResponseObj;
};
