import { URLPattern } from "urlpattern-polyfill/urlpattern";

/**
 * Compiles a list of routes into a list of compiled routes. Each route is compiled using URLPattern,
 * and default cache settings are applied if not explicitly provided.
 *
 * @param {Route[]} routes - An array of route objects to be compiled.
 * @returns {CompiledRoute[]} An array of compiled route objects.
 */
export const compileRoute = (routes: Route[]): CompiledRoute[] => {
  return routes.map(({ path, ...rest }) => ({
    path: new URLPattern({ pathname: path }),
    cache: rest.cache ?? true,
    ...rest,
  }));
};

/**
 * Finds the first route that matches the given request from a list of compiled routes. It returns the matching route
 * and the extracted parameters from the URL.
 *
 * @param {Request} request - The HTTP request object.
 * @param {CompiledRoute[]} compiledRoutes - An array of compiled routes to match against the request.
 * @returns {{ route: CompiledRoute, params: { [key: string]: string | undefined; }; } | undefined} An object containing the matched route and parameters, or undefined if no match is found.
 */
export const findMatchedRoute = (request: Request, compiledRoutes: CompiledRoute[]): { route: CompiledRoute; params: { [key: string]: string | undefined; }; } | undefined => {
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
 * Constructs a URL from a URLPattern and a set of parameters. Replaces each parameter in the pattern with
 * the corresponding value from the provided parameters.
 *
 * @param {URLPattern} pattern - The URLPattern object.
 * @param {RouteParams} [params] - An object containing key-value pairs for route parameters.
 * @returns {string} The constructed URL string.
 */
export function constructUrlFromPatternAndParams(pattern: URLPattern, params?: RouteParams): string {
  let patternStr = pattern.pathname;

  // Extract parameter names from the pattern
  const paramNames = patternStr.match(/:\w+\??/g) || [];

  for (const paramName of paramNames) {
      const isOptional = paramName.endsWith('?');
      const cleanParamName = paramName.replace(/:|\?/g, '');

      if (!isOptional && (!params || params[cleanParamName] === undefined)) {
          throw new Error(`Missing mandatory parameter: ${cleanParamName}`);
      }

      const value = params?.[cleanParamName] ?? '';
      patternStr = patternStr.replace(paramName, value);
  }

  return patternStr;
}