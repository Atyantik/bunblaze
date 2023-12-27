type RouteParams = { [key: string]: string | undefined };

type Route = {
	path: string;
	handler: (request: Request, params?: RouteParams) => Promise<JsonValue>;
};

type CompiledRoute = {
	path: URLPattern;
	handler: (
		request: Request,
		params?: RouteParams,
	) => Promise<JsonValue>;
};
