import { expect, test } from "bun:test";
import {
	jsonResponse,
	notFoundResponse,
	errorResponse,
} from "../../../utils/response.util";
import { RouteError } from "../../../utils/error.util";

async function responseToJson(response: Response) {
	const text = await response.text();
	return JSON.parse(text);
}

test("jsonResponse creates correct response", async () => {
	const data = { message: "Hello, world!" };
	const response = jsonResponse(data, 200);

	expect(response).toBeInstanceOf(Response);
	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe("application/json");

	// Assuming response.text() is a method to get the response body as text
	const responseBody = await response.text();
	expect(responseBody).toBe(JSON.stringify(data));

	// Check for CORS headers
	expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
	// ... other CORS headers checks
});

test("notFoundResponse creates 404 response", async () => {
	const response = notFoundResponse();

	expect(response).toBeInstanceOf(Response);
	expect(response.status).toBe(404);

	const responseBody = await response.text();
	expect(responseBody).toContain("Page not found");
	expect(responseBody).toContain('"code":404');
});

test("errorResponse returns correct format for generic errors", async () => {
	const genericError = new Error("Generic error");
	const response = errorResponse(genericError, 500);

	expect(response).toBeInstanceOf(Response);
	expect(response.status).toBe(500);

	const responseData = await responseToJson(response);
	expect(responseData.error).toBe("ServerError");
	expect(responseData.message).toBe("Generic error");
});

test("errorResponse handles RouteError correctly", async () => {
	const routeError = new RouteError("Route not found", 404);
	const response = errorResponse(routeError);

	expect(response.status).toBe(404);

	const responseData = await responseToJson(response);
	expect(responseData.error).toBe("RouteError");
	expect(responseData.message).toBe("Route not found");
});
