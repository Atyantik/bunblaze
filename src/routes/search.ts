import { proxyRoute } from '../utils/proxy.util';

export const searchRoute: Route = proxyRoute(
  '/:search',
  'https://search.foxdealer.com/api/vehicle/:search',
  // 'https://coffee.alexflipnote.dev/random.json',
  {
    // bypassParsing: true,
  }
);
