/**
 * Custom error class for handling routing-related errors in an application.
 * Extends the standard JavaScript Error object. This class includes additional properties like 'statusCode' and 'responseText' for HTTP error handling.
 * 
 * The constructor allows for an optional message and error options. It also modifies the error stack to exclude specific lines related to internal utility functions.
 * 
 * @extends Error
 */
export class RouteError extends Error {
	public statusCode = 500; // Default HTTP status code
  public responseText = ''; // Default response text

	/**
	 * Constructs a new RouteError object.
	 * 
	 * @param {string} [message] - Optional error message.
	 * @param {ErrorOptions} [options] - Optional error options.
	 */
	constructor(
			message = 'An error occurred',
			statusCode = 500,
			responseText = ''
	) {
			super(message);
			this.name = this.constructor.name;
			this.statusCode = statusCode;
			this.responseText = responseText;

			// Maintains proper stack trace for where our error was thrown (only available on V8)
			if (Error.captureStackTrace) {
					Error.captureStackTrace(this, RouteError);
			}

			// Custom logic for modifying the stack (if needed)
			if (this.stack) {
					// Example: Remove unwanted lines from the stack trace
					this.stack = this.stack.split("\n").filter((line) => !line.includes("/utils/error.util")).join("\n");
			}
	}
}