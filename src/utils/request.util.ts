import { hash } from "./hash.util";
import { requestMemoize } from "./memorize.util";
import { cache } from "./cache.util";
import { brotliCompress, canUseBrotli, gzipCompress } from "./compress.util";
import { jsonResponse, notFoundResponse } from "./response.util";

export const getRequestId = requestMemoize((request: Request) => {
	const url = new URL(request.url);

	// Sort the search parameters by their keys
	url.search = new URLSearchParams(
		Array.from(url.searchParams).sort((a, b) => a[0].localeCompare(b[0])),
	).toString();

	// Construct the URL with sorted search parameters
	const exceptHost = url.pathname + (url.search ? `?${url.search}` : "");
	const uniqueRequestKey = hash(exceptHost);

	return `req:${uniqueRequestKey}`;
});

export const compressAndCacheResponse = async (
	request: Request,
	data?: JsonValue,
	options?: {
		brotli?: boolean;
	},
) => {
	const stringData = JSON.stringify(data);
	let compressedData: Uint8Array = new Uint8Array();
	const requestId = getRequestId(request);
	const headers = new Headers();

	// Check if we can use brotli
	const useBr = !!(
		request.headers.get("accept-encoding")?.includes("br") &&
		options?.brotli &&
		canUseBrotli
	);

	if (useBr) {
		compressedData = await brotliCompress(stringData);
		headers.set("content-encoding", "br");
		headers.set("content-length", compressedData.length.toString());
	}

	// Check if we can use gzip
	const useGzip = request.headers.get("accept-encoding")?.includes("gzip");
	if (!compressedData?.length && useGzip) {
		compressedData = await gzipCompress(stringData);
		headers.set("content-encoding", "gzip");
		headers.set("content-length", compressedData.length.toString());
	}

	// Use text encoding
	if (!compressedData?.length) {
		const encoder = new TextEncoder();
		compressedData = encoder.encode(stringData);
		headers.delete("content-encoding");
		headers.set("content-length", compressedData.length.toString());
	}
	headers.set('X-Cache-Date', new Date().toISOString());

	if (compressedData?.length) {
		cache.set(requestId, {
			body: compressedData,
			status: 200,
			headers: Array.from(headers.entries()),
		});

		return jsonResponse(compressedData, 200, headers);
	}
	return notFoundResponse();
};
