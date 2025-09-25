export type JORFSearchMetaModule =
  | "publication"
  | "publication-tag"
  | "publication-ministere"
  | "publication-autorite"
  | "publication-nor"
  | "custom";

export type JORFSearchMetaGranularity =
  | "module"
  | "collection"
  | "item"
  | "filter";

export interface JORFSearchMetaFilter {
  key: string;
  value: string | boolean;
}

/**
 * Representation of a followable metadata entity exposed by JORFSearch.
 * It abstracts how the metadata item was produced and focuses on
 * the module it belongs to and the granularity at which it can be followed.
 */
export interface JORFSearchMetaItem {
  module: JORFSearchMetaModule;
  granularity: JORFSearchMetaGranularity;
  identifier?: string;
  label?: string;
  filters?: JORFSearchMetaFilter[];
}

export interface UserMetaFollowPreference {
  module: JORFSearchMetaModule;
  granularity: JORFSearchMetaGranularity;
  identifier?: string;
  label?: string;
  filters?: JORFSearchMetaFilter[];
}
