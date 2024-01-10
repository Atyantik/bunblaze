import { test, expect } from "bun:test";
import { URLPattern } from "urlpattern-polyfill/urlpattern";
import {
	compileRoute,
	constructUrlFromPatternAndParams,
	findMatchedRoute,
} from "../../../utils/router.util";

test("compileRoute - Compiles routes correctly", () => {
	const routes = [
		{ path: "/test", handler: () => ({}) },
		{ path: "/example", handler: () => ({}), cache: false },
	];

	const compiledRoutes = compileRoute(routes);

	expect(compiledRoutes.length).toBe(2);
	expect(compiledRoutes[0].path).toBeInstanceOf(URLPattern);
	expect(compiledRoutes[0].cache).toBe(true); // Default cache value
	expect(compiledRoutes[1].cache).toBe(false); // Explicitly provided cache value
});

test("findMatchedRoute - Finds the correct route", () => {
	const routes = [
		{ path: "/test", handler: () => ({}) },
		{ path: "/example", handler: () => ({}) },
	];
	const compiledRoutes = compileRoute(routes);

	const request = new Request("http://example.com/test");
	const match = findMatchedRoute(request, compiledRoutes);

	expect(match).toBeDefined();
	// @ts-ignore
	expect(match.route.path.pathname).toBe("/test");
});

test("findMatchedRoute - Returns undefined if no match", () => {
	const routes = [{ path: "/test", handler: () => ({}) }];
	const compiledRoutes = compileRoute(routes);

	const request = new Request("http://example.com/nonexistent");
	const match = findMatchedRoute(request, compiledRoutes);

	expect(match).toBeUndefined();
});

test("constructUrlFromPatternAndParams - Constructs URL correctly", () => {
	const pattern = new URLPattern({ pathname: "/users/:userId" });
	const url = constructUrlFromPatternAndParams(pattern, { userId: "123" });

	expect(url).toBe("/users/123");
});

test("constructUrlFromPatternAndParams - Constructs URL with mandatory parameter", () => {
  const pattern = new URLPattern({ pathname: '/users/:userId' });
  const url = constructUrlFromPatternAndParams(pattern, { userId: '123' });
  expect(url).toBe('/users/123');
});

test("constructUrlFromPatternAndParams - Throws error for missing mandatory parameter", () => {
  const pattern = new URLPattern({ pathname: '/users/:userId' });
  expect(() => constructUrlFromPatternAndParams(pattern)).toThrow('Missing mandatory parameter: userId');
});