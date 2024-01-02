import { proxyRoute } from '../utils/proxy.util';

export const searchRoute: Route = proxyRoute(
  '/:search',
  'https://coffee.alexflipnote.dev/random.json',
  {
    cache: false,
    bypassParsing: true,
  }
);