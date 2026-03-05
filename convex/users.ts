import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { nextCounterValue } from "./_utils";

export const getByOpenId = queryGeneric({
  args: { openId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_openId", (q) => q.eq("openId", args.openId))
      .unique();
  },
});

export const upsert = mutationGeneric({
  args: {
    openId: v.string(),
    name: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    loginMethod: v.optional(v.union(v.string(), v.null())),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
    lastSignedIn: v.optional(v.number()),
    ownerOpenId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_openId", (q) => q.eq("openId", args.openId))
      .unique();

    const computedRole = args.role ?? (args.ownerOpenId && args.openId === args.ownerOpenId ? "admin" : undefined);

    if (!existing) {
      const id = await nextCounterValue(ctx, "users");
      const docId = await ctx.db.insert("users", {
        id,
        openId: args.openId,
        name: args.name ?? null,
        email: args.email ?? null,
        loginMethod: args.loginMethod ?? null,
        role: computedRole ?? "user",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: args.lastSignedIn ?? now,
      });

      return await ctx.db.get(docId);
    }

    const patch: Record<string, unknown> = {
      updatedAt: now,
    };

    if (args.name !== undefined) patch.name = args.name;
    if (args.email !== undefined) patch.email = args.email;
    if (args.loginMethod !== undefined) patch.loginMethod = args.loginMethod;
    if (args.lastSignedIn !== undefined) patch.lastSignedIn = args.lastSignedIn;
    if (computedRole !== undefined) patch.role = computedRole;

    await ctx.db.patch(existing._id, patch);
    return await ctx.db.get(existing._id);
  },
});
