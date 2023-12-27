type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

interface JsonObject {
    [key: string]: JsonValue;
}

interface JsonArray extends Array<JsonValue> {}