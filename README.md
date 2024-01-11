# BunBlaze

<img src="https://raw.githubusercontent.com/Atyantik/bunblaze/main/images/BunBlaze.png" alt="BunBlaze Logo" width="400"/>

## Introduction
Welcome to BunBlaze, an ultra-efficient API proxy built on BunJS, designed for top-tier performance and scalability. Tailored for developers who demand speed and reliability, BunBlaze optimizes your API interactions with advanced caching and minimal overhead.

## Key Features
- **Stale-While-Revalidate Caching**: Smart caching for enhanced performance and data freshness.
- **Flexible Route Configuration**: Easy route setup with `urlpattern-polyfill`.
- **Brotli Compression Support**: Optimal handling of Brotli-compressed responses for peak efficiency.
- **Memory Optimization**: Allocates 70% of RAM for caching to balance performance and resource usage.
- **Vertical Scaling Focus**: Ideal for applications scaling up in resource capacity.
- **Multi-Platform IP Extraction**: Versatile client IP extraction across various platforms.
- **Docker Compatibility**: Includes a Dockerfile for streamlined deployments.
- **Minimalist Approach**: A no-frills, framework-free solution for API development.

## Prerequisites
- BunJS v1.0.x
- Brotli installed on your system for optimal results

## Installation
```bash
# Clone the repository
git clone [repository-url]

# Navigate to the project directory
cd bunblaze

# Install dependencies
bun install

# Start the application
bun dev
```

## Configuration
BunBlaze leverages Bun's .env file for easy configuration. Set your environment variables as needed for your project.

## Usage
BunBlaze is straightforward to use. Begin by configuring your routes in `__routes.ts`. Here's a simple example:

```typescript
// __routes.ts
import { coffeeRoute } from "./routes/coffee";

export const routes: Route[] = [
  coffeeRoute,
];

// routes/coffee.ts
import { proxyRoute } from '../core/utils/proxy.util';

export const coffeeRoute: Route = proxyRoute(
  '/coffee',
  'https://coffee.alexflipnote.dev/random.json',
);
```
The `proxyRoute` function creates routes easily, with caching and parsing options set to true by default.

## Production Deployment
To deploy BunBlaze in a production environment, follow these simple steps:
```bash
# Install only production dependencies
bun i --production

# Start the application in production mode
bun start
```
This ensures that only necessary dependencies are installed, optimizing performance and resource usage in a production setting.

## Testing
BunBlaze maintains a high standard of reliability with 100% code testing. All test cases can be found in the `./src/core/__tests__` directory. This ensures that every aspect of the application is thoroughly vetted for quality and performance.

## Troubleshooting and Common Issues
As BunBlaze is currently in an experimental phase (alpha/beta), some scenarios may not be fully tested. For production-ready APIs, it works reliably. For any specific issues, please refer to our [issues page](link-to-issues-page).

## Contributing
Your contributions are welcome! Please follow standard open-source contribution guidelines when contributing to BunBlaze. Check our [contribution guidelines](link-to-contribution-guidelines) for more details.

## License
BunBlaze is freely available for everyone and is distributed under the [MIT License](link-to-license). Please note, that we do not take responsibility for any issues that arise from the use of this software.

## Contact Information
For inquiries or support, reach out to us at support@atyantik.com.
