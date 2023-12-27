import { URLPattern } from "urlpattern-polyfill/urlpattern";
import { constructUrlFromPatternAndParams } from "./router.util";
import { RouteError } from "./error.util";

Error.stackTraceLimit = 50;

function getClientIp(request: Request) {
  // Cloudflare Workers
  // @ts-ignore
  if (request.cf?.ip) {
    // @ts-ignore
    return request.cf.ip;
  }

  // AWS Lambda@Edge (and other platforms that set 'X-Forwarded-For')
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
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
  const xClientIp = request.headers.get('x-client-ip');
  if (xClientIp) {
      return xClientIp;
  }

  // Azure Functions
  const xAzureForwardedFor = request.headers.get('x-azure-forwarded-for');
  if (xAzureForwardedFor) {
      return xAzureForwardedFor.split(',')[0].trim();
  }

  // Vercel and some other platforms
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
      return xRealIp;
  }

  // Heroku and other platforms that use a reverse proxy
  const xForwarded = request.headers.get('forwarded');
  if (xForwarded) {
      const match = xForwarded.match(/for="\[?([^\]]+)\]?"/i);
      return match ? match[1] : null;
  }

  // Fallback if IP address cannot be determined
  return null;
}

export const proxyRoute = (path: string, proxyUrl: string | URL): Route => ({
  path,
  handler: async (req: Request, params): Promise<JsonValue> => {
    const requestUrl = new URL(req.url);
    const proxyUrlObject = new URL(proxyUrl);
    requestUrl.hostname = proxyUrlObject.hostname;
    requestUrl.protocol = proxyUrlObject.protocol;
    requestUrl.port = proxyUrlObject.port;
    requestUrl.pathname = constructUrlFromPatternAndParams(new URLPattern({
      pathname: proxyUrlObject.pathname,
    }), params);

    const error = new RouteError();
    try {
      const proxyHeaders = new Headers(req.headers);

      /**
       * Avoid the following headers from being sent to the proxy
       */
      proxyHeaders.delete('host');
      proxyHeaders.delete('connection');
      proxyHeaders.delete('Strict-Transport-Security');
      proxyHeaders.delete('Content-Security-Policy');
      proxyHeaders.delete('Public-Key-Pins');

      /**
       * @todo add X-Forwarded-For header
       */
      proxyHeaders.set('X-Forwarded-Host', requestUrl.host);
      proxyHeaders.set('X-Forwarded-Proto', requestUrl.protocol.split(':')[0]);
      proxyHeaders.set('accept-encoding', 'gzip, deflate');

      const response = await fetch(requestUrl, {
        method: req.method,
        credentials: req.credentials,
        headers: proxyHeaders,
      });
      
      if (!response.ok) {
        const responseError = new RouteError(`Proxy request failed to url: ${requestUrl.toString()}`);
        responseError.statusCode = response.status;
        throw responseError;
      }

      const clonedRes = response.clone();
      try {
        const jsonData = await response.json();
        return jsonData as JsonValue;
      } catch (ex) {
        if (ex instanceof Error) {
          const responseError = new RouteError(`Invalid JSON returned from the API: ${requestUrl.toString()}`);
          responseError.statusCode = 400;
          responseError.responseText = await clonedRes.text();
          throw responseError;
        }
        throw ex;
      }
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
  }
});