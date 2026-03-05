import { FunctionReference, makeFunctionReference } from "convex/server";

export const queryRef = (name: string) =>
  makeFunctionReference(name) as unknown as FunctionReference<"query">;

export const mutationRef = (name: string) =>
  makeFunctionReference(name) as unknown as FunctionReference<"mutation">;

export const actionRef = (name: string) =>
  makeFunctionReference(name) as unknown as FunctionReference<"action">;
