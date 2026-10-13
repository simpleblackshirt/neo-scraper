import { TagCategory } from "../BooruTypes.js";

declare global {
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- R is part of jest's Matchers<R> contract
    interface Matchers<R> {
      toHaveTag(tagName: string, tagCategory?: TagCategory): CustomMatcherResult;
      toHaveNote(noteText: string): CustomMatcherResult;
      toHaveResolution(resolution: [number, number]): CustomMatcherResult;
      toHaveSource(source: string): CustomMatcherResult;
    }
  }
}

export {};
