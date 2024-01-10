type RouteParams = { [key: string]: string | undefined };

type RouteResponse = Response | JsonValue;

type Route = {
	path: string;
	cache?: boolean;
	handler: (
		request: Request,
		params?: RouteParams,
	) => Promise<RouteResponse> | RouteResponse;
};

type CompiledRoute = {
	path: URLPattern;
	cache: boolean;
	handler: (
		request: Request,
		params?: RouteParams,
	) => Promise<RouteResponse> | RouteResponse;
};
