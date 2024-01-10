/**
 * Serializes an array of data items to a file. Each item in the data array is converted into a binary format
 * and then written to the specified file. The serialization format includes lengths and contents of request IDs,
 * headers, status codes, and body content.
 *
 * @param {DataArray[]} data - An array of data items to be serialized.
 * @param {string} filename - The name of the file where the serialized data will be saved.
 * @returns {Promise<void>} A promise that resolves when the serialization and file writing is complete.
 */
export async function serializeToFile(
	data: DataArray[],
	filename: string,
): Promise<void> {
	if (!data?.length) {
		throw new Error("data is required");
	}
	if (!filename) {
		throw new Error("filename is required");
	}
	try {
		const serializedItems: Buffer[] = [];

		for (const item of data) {
			const requestIdUint8Array = new Uint8Array(Buffer.from(item[0], "utf-8"));
			const requestIdLengthBuffer = Buffer.alloc(4);
			requestIdLengthBuffer.writeUInt32LE(requestIdUint8Array.length);

			const headersString = Array.from(item[1].value.headers)
				.map((header) => {
					if (
						typeof header === "object" &&
						header !== null &&
						Array.isArray(header)
					) {
						return header.join(":");
					}
					return "";
				})
				.filter(Boolean)
				.join("\n");
			const headersUint8Array = new Uint8Array(
				Buffer.from(headersString, "utf-8"),
			);
			const headersLengthBuffer = Buffer.alloc(4);
			headersLengthBuffer.writeUInt32LE(headersUint8Array.length);

			const statusBuffer = Buffer.alloc(4);
			statusBuffer.writeInt32LE(item[1].value.status);

			const bodyLengthBuffer = Buffer.alloc(4);
			bodyLengthBuffer.writeUInt32LE(item[1].value.body.length);

			const serializedItem = Buffer.concat([
				requestIdLengthBuffer,
				requestIdUint8Array,
				headersLengthBuffer,
				headersUint8Array,
				statusBuffer,
				bodyLengthBuffer,
				item[1].value.body,
			]);
			serializedItems.push(serializedItem);
		}

		const combinedData = Buffer.concat(serializedItems);
		Bun.write(filename, combinedData);
	} catch (ex) {
		console.log(ex);
	}
}

/**
 * Deserializes data from a file into an array of data items. The function reads a file and converts
 * its binary content back into the original data format. This includes reconstructing request IDs, headers,
 * status codes, and body content.
 *
 * @param {string} filename - The name of the file from which to deserialize data.
 * @returns {DataArray[]} An array of deserialized data items.
 */
export async function deserializeFromFile(
	filename: string,
): Promise<DataArray[]> {
	const file = Bun.file(filename);
	if ((await file.exists()) === false) {
		throw new Error("File not found");
	}
	try {
		const data = Buffer.from(await file.arrayBuffer());
		const deserializedData: DataArray[] = [];

		let offset = 0;
		while (offset < data.length) {
			const requestIdLength = data.readUInt32LE(offset);
			offset += 4;
			const requestId = data
				.subarray(offset, offset + requestIdLength)
				.toString("utf-8");
			offset += requestIdLength;

			const headersLength = data.readUInt32LE(offset);
			offset += 4;
			const headersUint8Array = new Uint8Array(
				data.subarray(offset, offset + headersLength),
			);
			const headersString = Buffer.from(headersUint8Array).toString("utf-8");
			const headersArray: HeadersEntryType[] = headersString
				.split("\n")
				.map((header) => {
					const [key, ...rest] = header.split(":");
					const value = rest.join(":").trim(); // Rejoin the rest of the parts and trim any whitespace
					return [key, value] as HeadersEntryType;
				});
			offset += headersLength;

			const status = data.readInt32LE(offset);
			offset += 4;

			const bodyLength = data.readUInt32LE(offset); // Read the length of the body
			offset += 4;

			const body = new Uint8Array(data.subarray(offset, offset + bodyLength));
			offset += bodyLength;

			deserializedData.push([
				requestId,
				{
					value: {
						body: body,
						status: status,
						headers: headersArray,
					},
					size: bodyLength + headersLength + 8 + requestIdLength + 4, // additional bytes for requestIdLength
				},
			]);
		}
		return deserializedData;
	} catch (ex) {
		console.log(ex);
	}
	return [];
}
