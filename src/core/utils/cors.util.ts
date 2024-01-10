/**
 * Configuration object for Cross-Origin Resource Sharing (CORS). This includes settings like:
 * - Whether CORS is enabled or not
 * - The 'Access-Control-Allow-Origin' header value
 * - The 'Access-Control-Allow-Methods' header value
 * - The 'Access-Control-Allow-Headers' header value
 * - The 'Access-Control-Allow-Credentials' header value
 */
export const corsConfig = {
  enabled: true,
  allowOrigin: '*', // or specific domains like 'https://example.com'
  allowMethods: 'GET, POST, PUT, DELETE, OPTIONS',
  allowHeaders: 'Content-Type, Authorization, X-Unique-Id',
  allowCredentials: 'true' // or 'false' depending on your needs
};

/**
 * Sets CORS headers on an HTTP response based on the defined `corsConfig`. 
 * This function will only modify headers if CORS is enabled in the configuration.
 *
 * @param {Headers} headers - The Headers object of an HTTP response in which CORS headers are to be set.
 */
export function setCORSHeaders(headers: Headers) {
  if (corsConfig.enabled) {
      headers.set('Access-Control-Allow-Origin', corsConfig.allowOrigin);
      headers.set('Access-Control-Allow-Methods', corsConfig.allowMethods);
      headers.set('Access-Control-Allow-Headers', corsConfig.allowHeaders);
      if (corsConfig.allowCredentials) {
          headers.set('Access-Control-Allow-Credentials', corsConfig.allowCredentials);
      }
  }
}