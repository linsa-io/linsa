import { co, setDefaultSchemaPermissions, z } from "jazz-tools";

setDefaultSchemaPermissions({
  onInlineCreate: "sameAsContainer",
});

export const LocalTrack = co.map({
  name: z.string(),
  path: z.string(),
  url: z.string(),
  addedAt: z.number(),
  lastPlayedAt: z.optional(z.number()),
});
export type LocalTrack = co.loaded<typeof LocalTrack>;

export const PlayerRoot = co
  .map({
    recentTracks: co.list(LocalTrack),
    lastPlayedTrackId: z.optional(z.string()),
  })
  .withPermissions({ onInlineCreate: "newGroup" });
export type PlayerRoot = co.loaded<typeof PlayerRoot>;

export const PlayerAccount = co
  .account({
    profile: co.profile({
      avatar: co.optional(co.image()),
    }),
    root: PlayerRoot,
  })
  .withMigration(async (account) => {
    if (!account.$jazz.has("root")) {
      account.$jazz.set("root", {
        recentTracks: [],
        lastPlayedTrackId: undefined,
      });
    }

    if (!account.$jazz.has("profile")) {
      account.$jazz.set("profile", {
        name: "",
      });
    }
  })
  .resolved({
    profile: true,
    root: {
      recentTracks: { $each: true },
    },
  });
export type PlayerAccount = co.loaded<typeof PlayerAccount>;
