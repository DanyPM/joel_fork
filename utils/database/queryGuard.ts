type PlainRecord = Record<string, unknown>;

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
    if (key.startsWith("$") && !allowedOperators.has(key)) {
      throw new Error(`Disallowed MongoDB operator "${key}" detected at ${path}`);
    }
    assertAllowedOperators(nested, allowedOperators, `${path}.${key}`);
  }
};

export const guardFilter = <T extends PlainRecord | unknown>(filter: T): T => {
  assertAllowedOperators(filter, FILTER_OPERATORS, "filter");
  return filter;
};

export const guardUpdate = <T extends PlainRecord | unknown>(update: T): T => {
  assertAllowedOperators(update, DEFAULT_ALLOWED_KEYS, "update");
  return update;
};

export const guardPipeline = <T extends unknown[]>(pipeline: T): T => {
  pipeline.forEach((stage, index) =>
    assertAllowedOperators(stage, DEFAULT_ALLOWED_KEYS, `pipeline[${index}]`)
  );
  return pipeline;
};

export const guardAggregationStage = <T>(stage: T): T => {
  assertAllowedOperators(stage, DEFAULT_ALLOWED_KEYS, "pipelineStage");
  return stage;
};

export const allowedFilterOperators = FILTER_OPERATORS;
export const allowedUpdateOperators = UPDATE_OPERATORS;
