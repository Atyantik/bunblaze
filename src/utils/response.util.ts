import { RouteError } from "./error.util";

export const jsonResponse = (
	data: JsonValue | Uint8Array,
	status = 200,
	headers: Headers = new Headers(),
) => {
	const contentType = headers.get("content-type");
	if (!contentType) {
		headers.set("content-type", "application/json");
	}

	const body = data instanceof Uint8Array ? data : JSON.stringify(data);

	return new Response(body, {
		headers: headers,
		status: status,
	});
};

export const notFoundResponse = () => {
	return jsonResponse(
		{
			error: "Page not found!",
			code: 404,
		},
		404,
	);
};

export const errorResponse = (ex: unknown, statusCode = 500) => {
	const message = ex instanceof Error ? ex.message : "An error occurred";
	const stack = ex instanceof Error ? ex.stack : null;
	const status = ex instanceof RouteError ? ex.statusCode : statusCode;
	const responseText = ex instanceof RouteError ? ex.responseText : '';
	return jsonResponse(
		{
			error: message,
			stack: stack,
			code: status,
			...(responseText ? { responseText } : {}),
		} as JsonValue,
		status || 500,
	);
};
