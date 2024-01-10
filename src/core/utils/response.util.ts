import { setCORSHeaders } from "./cors.util";
import { RouteError } from "./error.util";

/**
 * Creates a JSON response object. Sets 'Content-Type' to 'application/json' if not already set.
 * It also applies CORS headers to the response.
 * 
 * @param {JsonValue | Uint8Array} data - The data to send in the response. Can be a JSON object or a Uint8Array.
 * @param {number} [status=200] - The HTTP status code for the response. Defaults to 200.
 * @param {Headers} [headers=new Headers()] - The headers to include in the response.
 * @returns {Response} A new Response object with the specified data, status, and headers.
 */
export const jsonResponse = (
	data: JsonValue | Uint8Array,
	status = 200,
	headers = new Headers(),
): Response => {
	const contentType = headers.get("content-type");
	if (!contentType) {
		headers.set("content-type", "application/json");
	}
	setCORSHeaders(headers as Headers);

	const body = data instanceof Uint8Array ? data : JSON.stringify(data);

	return new Response(body, {
		headers: headers as Headers,
		status: status,
	});
};

/**
 * Creates a standardized JSON response for a 404 Not Found error.
 *
 * @returns {Response} A Response object with a 404 status code and a JSON body indicating the page was not found.
 */
export const notFoundResponse = () => {
	return jsonResponse(
		{
			error: "Page not found!",
			code: 404,
		},
		404,
	);
};

/**
 * Creates a JSON response for an error. This function is designed to handle errors gracefully by providing a standardized
 * JSON structure for error responses. It differentiates between `RouteError` instances and other types of errors.
 * For `RouteError` instances, it uses the specific status code and response text from the error object.
 * For all other error types, it defaults to a 500 internal server error code and a generic error message.
 * The function also logs the full error details on the server for debugging purposes.
 *
 * @param {unknown} error - The error object. This can be any type, but specific handling is implemented for `Error` and `RouteError` instances.
 * @param {number} [defaultStatusCode=500] - The default HTTP status code for the response, used when the error doesn't specify a status code.
 * @returns {Response} A Response object representing the error, with a JSON body containing the error details.
 */
export const errorResponse = (error: unknown, defaultStatusCode = 500): Response => {
	// Determine if the error is a RouteError instance
	const isRouteError = error instanceof RouteError;
	const statusCode = isRouteError ? error.statusCode : defaultStatusCode;

	// Log the full error details on the server
	console.error(error);

	// Create a user-friendly error message
	let message = 'An unexpected error occurred';
	if (isRouteError) {
			message = error.message || 'A routing error occurred';
	} else if (error instanceof Error) {
			message = error.message;
	}

	// Optionally include responseText for RouteError
	const responseText = isRouteError && error.responseText ? { responseText: error.responseText } : {};

	// Build the error response
	const errResponse = {
			error: isRouteError ? 'RouteError' : 'ServerError',
			message: message,
			statusCode: statusCode,
			...responseText,
	};

	// Return the error response with the appropriate HTTP status code
	return new Response(JSON.stringify(errResponse), {
			status: statusCode,
			headers: { 'Content-Type': 'application/json' },
	});
};