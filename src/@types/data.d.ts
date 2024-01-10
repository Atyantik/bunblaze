// Type of the 'entries' method on Headers
type HeadersEntriesType = Headers["entries"];

// Type of the iterator returned by the 'entries' method
type HeadersIteratorType = ReturnType<HeadersEntriesType>;

type HeadersEntryType = ReturnType<HeadersIteratorType['next']>['value'];

type DataItem = {
	value: ResponseCacheableObject;
	size: number;
};
type DataArray = [string, LRUCache.Entry<DataItem>];