import { URLPattern } from "urlpattern-polyfill/urlpattern";
import { constructUrlFromPatternAndParams } from "./router.util";
import { RouteError } from "./error.util";
import { brotliDecompress } from "./compress.util";
import { ENCODINGS, compressString } from "./http.util";
import { isBunVersionGreaterOrEqual } from "./version.util";

Error.stackTraceLimit = 50;

/**
 * Retrieves the client's IP address from a request. It supports various platforms and server setups,
 * including Cloudflare Workers, AWS Lambda@Edge, Node.js/Express.js, Google Cloud Functions, Azure Functions,
 * Vercel, and Heroku. The function prioritizes different headers to find the IP based on the platform.
 *
 * @param {Request} request - The HTTP request object.
 * @returns {string | null} The client's IP address if available, otherwise null.
 */
function getClientIp(request: Request): string | null {
	try {
		// Cloudflare Workers
		// @ts-ignore
		if (request.cf?.ip) {
			// @ts-ignore
			return request.cf.ip;
		}

		// AWS Lambda@Edge (and other platforms that set 'X-Forwarded-For')
		const xForwardedFor = request.headers.get("x-forwarded-for");
		if (xForwardedFor) {
			return xForwardedFor.split(",")[0].trim();
		}

		// Node.js / Express.js (and similar environments)
		// @ts-ignore
		if (request.connection?.remoteAddress) {
			// @ts-ignore
			return request.connection.remoteAddress;
		}
		// @ts-ignore
		if (request.socket?.remoteAddress) {
			// @ts-ignore
			return request.socket.remoteAddress;
		}
		// @ts-ignore
		if (request.ip) {
			// @ts-ignore
			return request.ip; // Express.js specific
		}

		// Google Cloud Functions / Firebase Functions
		const xClientIp = request.headers.get("x-client-ip");
		if (xClientIp) {
			return xClientIp;
		}

		// Azure Functions
		const xAzureForwardedFor = request.headers.get("x-azure-forwarded-for");
		if (xAzureForwardedFor) {
			return xAzureForwardedFor.split(",")[0].trim();
		}

		// Vercel and some other platforms
		const xRealIp = request.headers.get("x-real-ip");
		if (xRealIp) {
			return xRealIp;
		}

		// Heroku and other platforms that use a reverse proxy
		const xForwarded = request.headers.get("forwarded");
		if (xForwarded) {
			const match = xForwarded.match(/for="\[?([^\]]+)\]?"/i);
			return match ? match[1] : null;
		}
	} catch (ex) {
		console.log("Error while getting client IP: ", ex);
	}

	// Fallback if IP address cannot be determined
	return null;
}

/**
 * Handles and decompresses a Brotli-compressed response. It converts the response's ArrayBuffer to a Uint8Array,
 * decompresses it, and then parses the JSON content.
 *
 * @param {Response} response - The Brotli-compressed HTTP response.
 * @returns {Promise<JsonValue>} A promise that resolves to the JSON content of the decompressed response.
 */
const handleBroltiResponse = async (response: Response): Promise<JsonValue> => {
	const arrayBuffer = await response.arrayBuffer();
	const responseData = await brotliDecompress(arrayBuffer);
	return JSON.parse(responseData);
};

/**
 * Creates a proxy route configuration. The function proxies requests to a specified URL and optionally
 * caches responses and bypasses parsing. It also handles forwarding headers, client IP, and decoding
 * Brotli-compressed responses.
 *
 * @param {string} path - The path pattern for the route.
 * @param {string | URL} proxyUrl - The URL to which the request should be proxied.
 * @param {Object} [options] - Optional settings for the proxy route such as caching and parsing bypass.
 * @returns {Route} A route configuration object.
 */
export const proxyRoute = (
	path: string,
	proxyUrl: string | URL,
	options?: {
		cache?: boolean;
		bypassParsing?: boolean;
	},
): Route => ({
	path,
	cache: options?.cache ?? true,
	handler: async (req: Request, params): Promise<Response | JsonValue> => {
		// Create requestURL object from the request's url
		const requestUrl = new URL(req.url);
		// Create proxyUrlObject from the proxyUrl
		const proxyUrlObject = new URL(proxyUrl);

		/**
		 * Update the proxyURLObject with the request's url
		 */
		proxyUrlObject.search = requestUrl.search;
		proxyUrlObject.pathname = constructUrlFromPatternAndParams(
			new URLPattern({
				pathname: proxyUrlObject.pathname,
			}),
			params,
		);

		const error = new RouteError();
		try {
			const proxyHeaders = new Headers(req.headers);

			/**
			 * Avoid the following headers from being sent to the proxy
			 */
			proxyHeaders.delete("host");
			proxyHeaders.delete("connection");
			proxyHeaders.delete("Strict-Transport-Security");
			proxyHeaders.delete("Content-Security-Policy");
			proxyHeaders.delete("Public-Key-Pins");

			/**
			 * @todo add X-Forwarded-For header
			 */
			proxyHeaders.set("X-Forwarded-Host", requestUrl.host);
			proxyHeaders.set("X-Forwarded-Proto", requestUrl.protocol.split(":")[0]);
			const clientIp = getClientIp(req);
			if (clientIp) {
				proxyHeaders.set("X-Forwarded-For", clientIp);
			}
			/** Accept Brotli as well */
			proxyHeaders.set("accept-encoding", "br, gzip, deflate");

			let response = await fetch(proxyUrlObject, {
				method: req.method,
				credentials: req.credentials,
				headers: proxyHeaders,
			});

			const responseEncoding = response.headers.get("content-encoding");
			
			/**
			 * Middleware to convert proxy response of brotli to
			 * current brotli handable version
			 */
			if (responseEncoding === ENCODINGS.BROTLI) {
				const responseText = await response.text();
				const compressedData = await compressString(responseText, ENCODINGS.BROTLI);	
				const headers = new Headers(response.headers);
				headers.set("content-length", compressedData.length.toString());
				headers.set("content-encoding", ENCODINGS.BROTLI);
				response = new Response(compressedData, {
					status: response.status,
					statusText: response.statusText,
					headers: headers as Headers,
				});
			}

			if (options?.bypassParsing) {
				return response as Response;
			}

			if (!response.ok) {
				const responseError = new RouteError(
					`Proxy request failed to url: ${requestUrl.toString()}`,
				);
				responseError.statusCode = response.status;
				throw responseError;
			}

			const clonedRes = response.clone();
			try {
				if (
					responseEncoding === ENCODINGS.BROTLI
					&& !isBunVersionGreaterOrEqual("1.0.22")
				) {
					return handleBroltiResponse(response as Response);
				}
				const jsonData = await response.json();
				return jsonData as JsonValue;
			} catch (ex) {
				if (ex instanceof Error) {
					const responseError = new RouteError(
						`Invalid JSON returned from the API: ${requestUrl.toString()}`,
					);
					responseError.statusCode = 400;
					responseError.responseText = await clonedRes.text();
					throw responseError;
				}
				throw ex;
			}
		} catch (ex) {
			if (ex instanceof RouteError) {
				throw ex;
			}
			if (ex instanceof Error) {
				error.message = ex.message;
				error.stack = ex.stack;
			}
			throw error;
		}
	},
});
