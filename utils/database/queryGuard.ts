type PlainRecord = Record<string, unknown>;

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

const FILTER_OPERATORS = new Set<string>([
  "$and",
  "$or",
  "$nor",
  "$eq",
  "$ne",
  "$in",
  "$nin",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$exists",
  "$regex",
  "$elemMatch",
  "$size",
  "$all",
  "$not",
  "$type",
  "$geoWithin",
  "$geoIntersects",
  "$near",
  "$nearSphere"
]);

const UPDATE_OPERATORS = new Set<string>([
  "$set",
  "$setOnInsert",
  "$unset",
  "$inc",
  "$mul",
  "$min",
  "$max",
  "$rename",
  "$currentDate",
  "$addToSet",
  "$push",
  "$pull",
  "$pullAll",
  "$pop",
  "$bit",
  "$each",
  "$position",
  "$slice",
  "$sort"
]);

const DEFAULT_ALLOWED_KEYS = new Set<string>([
  ...FILTER_OPERATORS,
  ...UPDATE_OPERATORS
]);

const isPlainObject = (value: unknown): value is PlainRecord => {
  if (value === null || typeof value !== "object") return false;
  if (value instanceof Date || value instanceof RegExp) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
};

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce<PlainRecord>((acc, [key, nested]) => {
      acc[key] = sanitizeValue(nested);
      return acc;
    }, {});
  }

  if (typeof value === "string") {
    return value.normalize("NFKC").replace(CONTROL_CHARS, "");
  }

  return value;
};

const assertAllowedOperators = (
  value: unknown,
  allowedOperators: Set<string>,
  path: string
): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertAllowedOperators(item, allowedOperators, `${path}[${index}]`)
    );
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error(`Unsafe property name "${key}" detected at ${path}`);
    }
    if (key.startsWith("$") && !allowedOperators.has(key)) {
      throw new Error(`Disallowed MongoDB operator "${key}" detected at ${path}`);
    }
    assertAllowedOperators(nested, allowedOperators, `${path}.${key}`);
  }
};

export const guardFilter = <T extends PlainRecord | unknown>(filter: T): T => {
  const sanitizedFilter = sanitizeValue(filter) as T;
  assertAllowedOperators(sanitizedFilter, FILTER_OPERATORS, "filter");
  return sanitizedFilter;
};

export const guardUpdate = <T extends PlainRecord | unknown>(update: T): T => {
  const sanitizedUpdate = sanitizeValue(update) as T;
  assertAllowedOperators(sanitizedUpdate, DEFAULT_ALLOWED_KEYS, "update");
  return sanitizedUpdate;
};

export const guardPipeline = <T extends unknown[]>(pipeline: T): T => {
  const sanitizedPipeline = sanitizeValue(pipeline) as T;
  sanitizedPipeline.forEach((stage, index) =>
    assertAllowedOperators(stage, DEFAULT_ALLOWED_KEYS, `pipeline[${index}]`)
  );
  return sanitizedPipeline;
};

export const guardAggregationStage = <T>(stage: T): T => {
  const sanitizedStage = sanitizeValue(stage) as T;
  assertAllowedOperators(sanitizedStage, DEFAULT_ALLOWED_KEYS, "pipelineStage");
  return sanitizedStage;
};

export const allowedFilterOperators = FILTER_OPERATORS;
export const allowedUpdateOperators = UPDATE_OPERATORS;
