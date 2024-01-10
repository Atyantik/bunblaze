import { proxyRoute } from '../core/utils/proxy.util';

export const coffeeRoute: Route = proxyRoute(
  '/coffee',
  'https://coffee.alexflipnote.dev/random.json',
  {
    cache: true,
    bypassParsing: true,
  }
);