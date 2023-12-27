import fs from "fs";

/**
 * Serialize data to file
 * @param data DataArray[]
 * @param filename String
 */
export function serializeToFile(data: DataArray[], filename: string): void {
	const serializedItems: Buffer[] = [];

	for (const item of data) {
		const requestIdUint8Array = new Uint8Array(Buffer.from(item[0], "utf-8"));
		const requestIdLengthBuffer = Buffer.alloc(4);
		requestIdLengthBuffer.writeUInt32LE(requestIdUint8Array.length);

		const headersString = Array.from(item[1].value.headers)
			.map((header) => header.join(":"))
			.join("\n");
		const headersUint8Array = new Uint8Array(
			Buffer.from(headersString, "utf-8"),
		);
		const headersLengthBuffer = Buffer.alloc(4);
		headersLengthBuffer.writeUInt32LE(headersUint8Array.length);

		const statusBuffer = Buffer.alloc(4);
		statusBuffer.writeInt32LE(item[1].value.status);

		const serializedItem = Buffer.concat([
			requestIdLengthBuffer,
			requestIdUint8Array,
			headersLengthBuffer,
			headersUint8Array,
			statusBuffer,
			item[1].value.body,
		]);
		serializedItems.push(serializedItem);
	}

	const combinedData = Buffer.concat(serializedItems);
	Bun.write(filename, combinedData);
}

// Deserialize data from file
export function deserializeFromFile(filename: string): DataArray[] {
	if (!fs.existsSync(filename)) {
		return [];
	}
	const data = fs.readFileSync(filename);
	const deserializedData: DataArray[] = [];

	let offset = 0;
	while (offset < data.length) {
		const requestIdLength = data.readUInt32LE(offset);
		offset += 4;
		const requestId = data
			.slice(offset, offset + requestIdLength)
			.toString("utf-8");
		offset += requestIdLength;

		const headersLength = data.readUInt32LE(offset);
		offset += 4;
		const headersUint8Array = new Uint8Array(
			data.slice(offset, offset + headersLength),
		);
		const headersString = Buffer.from(headersUint8Array).toString("utf-8");
		const headersArray: HeadersEntryType[] = headersString
			.split("\n")
			.map((header) => header.split(":") as HeadersEntryType);
		offset += headersLength;

		const status = data.readInt32LE(offset);
		offset += 4;

		const bodyLength = data.length - offset;
		const body = new Uint8Array(data.slice(offset, offset + bodyLength));
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
}
