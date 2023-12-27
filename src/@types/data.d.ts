// Type of the 'entries' method on Headers
type HeadersEntriesType = Headers["entries"];

// Type of the iterator returned by the 'entries' method
type HeadersIteratorType = ReturnType<HeadersEntriesType>;

type HeadersEntryType = ReturnType<HeadersIteratorType['next']>['value'];

type DataItem = {
	value: {
		body: Uint8Array;
		status: number;
		headers: HeadersEntryType[];
	};
	size: number;
};
type DataArray = [string, DataItem];