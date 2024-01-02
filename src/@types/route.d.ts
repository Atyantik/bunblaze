type RouteParams = { [key: string]: string | undefined };

type Route = {
	path: string;
	cache?: boolean;
	handler: (
		request: Request,
		params?: RouteParams,
	) => Promise<Response | JsonValue>;
};

type CompiledRoute = {
	path: URLPattern;
	cache: boolean;
	handler: (
		request: Request,
		params?: RouteParams,
	) => Promise<Response | JsonValue>;
};
