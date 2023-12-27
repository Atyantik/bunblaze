export class RouteError extends Error {
	statusCode = 500;
  responseText = '';
	constructor(
		message?: string | undefined,
		options?: ErrorOptions | undefined,
	) {
		super(message, options);
		this.name = this.constructor.name;

		// Modify the stack to remove unwanted lines
		if (this.stack) {
			this.stack = this.stack
				.split("\n")
				.filter((line) => !line.includes("/utils/"))
				.join("\n");
		}
	}
}
