import { proxyRoute } from '../utils/proxy.util';

export const searchRoute: Route = proxyRoute(
  '/',
  'https://coffee.alexflipnote.dev/random.json',
);