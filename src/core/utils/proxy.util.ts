import { URLPattern } from "urlpattern-polyfill/urlpattern";
import { constructUrlFromPatternAndParams } from "./router.util";
import { RouteError } from "./error.util";
import { ENCODINGS } from "./http.util";

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

type ProxyUrlFn = ((req: Request, params?: RouteParams) => string | Promise<string>);
/**
 * Creates a proxy route configuration. The function proxies requests to a specified URL and optionally
 * caches responses and bypasses parsing. It also handles forwarding headers, client IP, and decoding
 * Brotli-compressed responses.
 * options: {
 *	 cache?: boolean;
 * }
 *
 * @param {string} path - The path pattern for the route.
 * @param {string | URL} proxyUrl - The URL to which the request should be proxied.
 * @param {Object} [options] - Optional settings for the proxy route such as caching and parsing bypass.
 * @returns {Route} A route configuration object.
 */
export const proxyRoute = (
	path: string,
	proxyUrl: string | URL | ProxyUrlFn,
	options?: {
		cache?: boolean;
	},
): Route => ({
	path,
	cache: options?.cache ?? true,
	handler: async (req: Request, params): Promise<Response | JsonValue> => {
		let url = '';
		if (proxyUrl instanceof Function) {
			url = await proxyUrl(req, params);
		} else {
			url = proxyUrl.toString();
		}
		// Create requestURL object from the request's url
		const requestUrl = new URL(req.url);
		// Create proxyUrlObject from the proxyUrl
		const proxyUrlObject = new URL(url);

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

			const proxyRequestInit: RequestInit = {
				method: req.method,
				credentials: req.credentials,
				headers: proxyHeaders,
			};
			if (req.headers.get("content-type")?.includes?.("multipart/form-data") && req.body) {
				proxyHeaders.delete("content-length");
				proxyHeaders.delete("content-type");
				proxyRequestInit.body = await req.formData();
			}
			
			let response = await fetch(proxyUrlObject, proxyRequestInit);

			// Modify response to IDENTITY content-encoding
			// @todo: Once bun has inbuilt support for Brotli,
			// this won't be necessary
			const responseText = await response.text();
			const responseHeaders = new Headers(response.headers);
			responseHeaders.set("content-encoding", ENCODINGS.IDENTITY);
			responseHeaders.set("content-length", responseText.length.toString());
			response = new Response(responseText, {
				status: response.status,
				headers:  responseHeaders as Headers,
				statusText: response.statusText,
			});

			if (!response.ok) {
				const responseError = new RouteError(
					`Proxy request failed to url: ${requestUrl.toString()}`,
				);
				responseError.statusCode = response.status;
				responseError.responseText = await response.text();
				console.log(responseError);
				throw responseError;
			}
			return response;
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
