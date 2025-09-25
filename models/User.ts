import { Schema as _Schema, Types, model } from "mongoose";
const Schema = _Schema;
import umami from "../utils/umami.ts";
import {
  ISession,
  IPeople,
  IUser,
  IUserFollowedMetaPreference,
  UserMetaFollowPreference,
  UserModel
} from "../types.ts";
import { FunctionTags } from "../entities/FunctionTags.ts";
import { loadUser } from "../entities/Session.ts";
import { cleanPeopleName } from "../utils/JORFSearch.utils.ts";
import { getISOWeek } from "../utils/date.utils.ts";

export const USER_SCHEMA_VERSION = 4;

function sortMetaFilters(
  filters: IUserFollowedMetaPreference["filters"]
): IUserFollowedMetaPreference["filters"] {
  return [...filters].sort((a, b) => a.key.localeCompare(b.key));
}

function areMetaFiltersEqual(
  a: IUserFollowedMetaPreference["filters"],
  b: IUserFollowedMetaPreference["filters"]
): boolean {
  if (a.length !== b.length) return false;
  const sortedA = sortMetaFilters(a);
  const sortedB = sortMetaFilters(b);
  return sortedA.every((filter, index) => {
    const other = sortedB[index];
    if (filter.key !== other.key) return false;
    return filter.value === other.value;
  });
}

const UserSchema = new Schema<IUser, UserModel>(
  {
    chatId: {
      type: Number,
      required: true
    },
    messageApp: {
      type: String,
      required: true
    },
    language_code: {
      type: String,
      required: true,
      default: "fr"
    },
    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active"
    },
    followedPeople: {
      type: [
        {
          peopleId: {
            type: Types.ObjectId
          },
          lastUpdate: {
            type: Date,
            default: Date.now
          }
        }
      ],
      default: []
    },
    followedFunctions: {
      type: [
        {
          functionTag: {
            type: String
          },
          lastUpdate: {
            type: Date,
            default: Date.now
          }
        }
      ],
      default: []
    },
    followedNames: {
      type: [String],
      default: []
    },
    followedOrganisations: {
      type: [
        {
          wikidataId: {
            type: String
          },
          lastUpdate: {
            type: Date,
            default: Date.now
          }
        }
      ],
      default: []
    },
    followedMeta: {
      type: [
        {
          module: {
            type: String,
            required: true
          },
          granularity: {
            type: String,
            enum: ["module", "collection", "item", "filter"],
            required: true
          },
          identifier: {
            type: String
          },
          label: {
            type: String
          },
          filters: {
            type: [
              {
                key: { type: String, required: true },
                value: { type: Schema.Types.Mixed, required: true }
              }
            ],
            default: []
          },
          lastUpdate: {
            type: Date,
            default: Date.now
          }
        }
      ],
      default: []
    },
    schemaVersion: {
      type: Number,
      required: true
    },

    lastInteractionDay: {
      type: Date
    },
    lastInteractionWeek: {
      type: Date
    },
    lastInteractionMonth: {
      type: Date
    },
    lastMessageReceivedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

UserSchema.static(
  "findOrCreate",
  async function (session: ISession): Promise<IUser> {
    if (session.user != null) return session.user;

    const user: IUser | null = await loadUser(session);

    if (user != null) return user;

    await umami.log({ event: "/new-user" });
    return await this.create({
      chatId: session.chatId,
      messageApp: session.messageApp,
      language_code: session.language_code,
      schemaVersion: USER_SCHEMA_VERSION
    });
  }
);

UserSchema.method(
  "updateInteractionMetrics",
  async function updateInteractionMetrics(this: IUser) {
    let needSaving = false;

    if (this.status === "blocked") {
      await umami.log({ event: "/user-unblocked-joel" });
      this.status = "active";
      needSaving = true;
    }

    const now = new Date();
    const currentDay = new Date(now);
    currentDay.setHours(4, 0, 0, 0);

    // For daily active users - check if last interaction was before today
    if (
      this.lastInteractionDay === undefined ||
      this.lastInteractionDay.toDateString() !== currentDay.toDateString()
    ) {
      this.lastInteractionDay = currentDay;
      await umami.log({ event: "/daily-active-user" });
      needSaving = true;
    }

    // For weekly active users - check if last interaction was in a different ISO week
    const thisWeek = getISOWeek(now);
    const lastInteractionWeek = this.lastInteractionWeek
      ? getISOWeek(this.lastInteractionWeek)
      : undefined;
    if (
      this.lastInteractionWeek === undefined ||
      thisWeek !== lastInteractionWeek
    ) {
      this.lastInteractionWeek = currentDay;
      await umami.log({ event: "/weekly-active-user" });
      needSaving = true;
    }

    // For monthly active users - check if last interaction was in a different month
    if (
      this.lastInteractionMonth === undefined ||
      this.lastInteractionMonth.getMonth() !== now.getMonth() ||
      this.lastInteractionMonth.getFullYear() !== now.getFullYear()
    ) {
      const startMonth = new Date(currentDay);
      startMonth.setDate(1);
      this.lastInteractionMonth = startMonth;
      await umami.log({ event: "/monthly-active-user" });
      needSaving = true;
    }

    if (needSaving) await this.save();
  }
);

UserSchema.method(
  "checkFollowedPeople",
  function checkFollowedPeople(this: IUser, people: IPeople): boolean {
    return this.followedPeople.some(
      (person) => person.peopleId.toString() === people._id.toString()
    );
  }
);

UserSchema.method(
  "addFollowedPeople",
  async function addFollowedPeople(this: IUser, peopleToFollow: IPeople) {
    if (this.checkFollowedPeople(peopleToFollow)) return false;
    this.followedPeople.push({
      peopleId: peopleToFollow._id,
      lastUpdate: new Date()
    });
    await this.save();
    return true;
  }
);

UserSchema.method(
  "addFollowedPeopleBulk",
  async function addFollowedPeopleBulk(this: IUser, peopleToFollow: IPeople[]) {
    for (const people of peopleToFollow) {
      if (this.checkFollowedPeople(people)) continue;
      this.followedPeople.push({
        peopleId: people._id,
        lastUpdate: new Date()
      });
    }
    await this.save();
    return true;
  }
);

UserSchema.method(
  "removeFollowedPeople",
  async function removeFollowedPeople(this: IUser, peopleToUnfollow: IPeople) {
    if (!this.checkFollowedPeople(peopleToUnfollow)) return false;
    this.followedPeople = this.followedPeople.filter((elem) => {
      return !(elem.peopleId.toString() === peopleToUnfollow._id.toString());
    });
    await this.save();
    return true;
  }
);

UserSchema.method(
  "checkFollowedFunction",
  function checkFollowedFunction(this: IUser, fct: FunctionTags): boolean {
    return this.followedFunctions.some((elem) => {
      return elem.functionTag === fct;
    });
  }
);

UserSchema.method(
  "addFollowedFunction",
  async function addFollowedFunction(this: IUser, fct: FunctionTags) {
    if (this.checkFollowedFunction(fct)) return false;
    this.followedFunctions.push({ functionTag: fct, lastUpdate: new Date() });
    await this.save();
    return true;
  }
);

UserSchema.method(
  "removeFollowedFunction",
  async function removeFollowedFunctions(this: IUser, fct: FunctionTags) {
    if (!this.checkFollowedFunction(fct)) return false;
    this.followedFunctions = this.followedFunctions.filter((elem) => {
      return elem.functionTag !== fct;
    });
    await this.save();
    return true;
  }
);

UserSchema.method(
  "checkFollowedName",
  function checkFollowedName(this: IUser, name: string): boolean {
    const nameClean = cleanPeopleName(name);
    return this.followedNames.some((elem) => {
      return elem.toUpperCase() === nameClean.toUpperCase();
    });
  }
);

UserSchema.method(
  "addFollowedName",
  async function addFollowedName(this: IUser, name: string) {
    if (this.checkFollowedName(name)) return false;
    this.followedNames.push(name);
    await this.save();
    return true;
  }
);

UserSchema.method(
  "removeFollowedName",
  async function removeFollowedName(this: IUser, name: string) {
    if (!this.checkFollowedName(name)) return false;
    this.followedNames = this.followedNames.filter((elem) => {
      return elem.toUpperCase() !== name.toUpperCase();
    });
    await this.save();
    return true;
  }
);

UserSchema.method(
  "checkFollowedMeta",
  function checkFollowedMeta(
    this: IUser,
    preference: UserMetaFollowPreference
  ): boolean {
    const normalizedFilters: IUserFollowedMetaPreference["filters"] = (
      preference.filters ?? []
    ).map((filter) => ({
      key: filter.key,
      value: filter.value
    }));

    return this.followedMeta.some((meta) => {
      return (
        meta.module === preference.module &&
        meta.granularity === preference.granularity &&
        meta.identifier === preference.identifier &&
        areMetaFiltersEqual(meta.filters, normalizedFilters)
      );
    });
  }
);

UserSchema.method(
  "addFollowedMeta",
  async function addFollowedMeta(
    this: IUser,
    preference: UserMetaFollowPreference
  ) {
    const normalizedFilters: IUserFollowedMetaPreference["filters"] = (
      preference.filters ?? []
    ).map((filter) => ({
      key: filter.key,
      value: filter.value
    }));

    if (
      this.checkFollowedMeta({
        ...preference,
        filters: normalizedFilters
      })
    ) {
      return false;
    }

    const metaPreference: IUserFollowedMetaPreference = {
      module: preference.module,
      granularity: preference.granularity,
      identifier: preference.identifier,
      label: preference.label,
      filters: normalizedFilters,
      lastUpdate: new Date()
    };

    this.followedMeta.push(metaPreference);
    await this.save();
    return true;
  }
);

UserSchema.method(
  "removeFollowedMeta",
  async function removeFollowedMeta(
    this: IUser,
    preference: UserMetaFollowPreference
  ) {
    const normalizedFilters: IUserFollowedMetaPreference["filters"] = (
      preference.filters ?? []
    ).map((filter) => ({
      key: filter.key,
      value: filter.value
    }));

    if (
      !this.checkFollowedMeta({
        ...preference,
        filters: normalizedFilters
      })
    )
      return false;

    this.followedMeta = this.followedMeta.filter((meta) => {
      if (meta.module !== preference.module) return true;
      if (meta.granularity !== preference.granularity) return true;
      if (meta.identifier !== preference.identifier) return true;
      return !areMetaFiltersEqual(meta.filters, normalizedFilters);
    });

    await this.save();
    return true;
  }
);

UserSchema.method(
  "followsNothing",
  function followsNothing(this: IUser): boolean {
    return (
      this.followedPeople.length +
        this.followedNames.length +
        this.followedFunctions.length +
        this.followedOrganisations.length +
        this.followedMeta.length ===
      0
    );
  }
);

UserSchema.index({ "followedPeople.peopleId": 1 });
UserSchema.index({ "followedFunctions.functionTag": 1 });
UserSchema.index({ "followedOrganisations.wikidataId": 1 });
UserSchema.index({
  "followedMeta.module": 1,
  "followedMeta.identifier": 1,
  "followedMeta.granularity": 1
});

export default model<IUser, UserModel>("User", UserSchema);
