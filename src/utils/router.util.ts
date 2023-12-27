import { URLPattern } from "urlpattern-polyfill/urlpattern";

/**
 * From a list of routes, compile them into a list of compiled routes
 * @param routes Route[]
 * @returns CompiledRoute[]
 */
export const compileRoute = (routes: Route[]) => {
  return routes.map(({ path, ...rest }) => ({
    path: new URLPattern({ pathname: path }),
    ...rest,
  }));
};

/**
 * From a request and a list of compiled routes, find the first route that matches the request
 * @param request Request
 * @param compiledRoutes CompiledRoute[]
 * @returns match { route: CompiledRoute, params: { [key: string]: string | undefined; }; } | undefined
 */
export const findMatchedRoute = (request: Request, compiledRoutes: CompiledRoute[]) => {
  let match: {
    route: CompiledRoute;
    params: { [key: string]: string | undefined; };
  } | undefined;

  let i = compiledRoutes.length
  while(!match && i > 0) {
    i -= 1;
    const route = compiledRoutes[i];
    const execRoute = route.path.exec(request.url);
    const params = execRoute?.pathname?.groups;
    if (params) {
      match = {
        route,
        params,
      };
    }
  }
  return match;
};

/**
 * Create a URL from a URLPattern and params
 * @param pattern URLPattern
 * @param params Record<string, string>
 * @returns string
 */
export function constructUrlFromPatternAndParams(pattern:  URLPattern, params?: RouteParams) {
  // Convert the pattern into a string
  let patternStr = pattern.pathname;

  // Replace each parameter in the pattern with the corresponding value from params
  for (const [key, value] of Object.entries(params ?? {})) {
    patternStr = patternStr.replace(`:${key}`, value ?? '');
  }
  return patternStr;
}