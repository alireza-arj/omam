/**
 * Avatar storage.
 *
 * Avatars used to be persisted as `data:image/...;base64,...` strings directly
 * in the `User` row — up to ~600 KB of text read back on every profile query.
 * On native they are now files in the app's document directory and the row
 * holds only a `file://` URI.
 *
 * `expo-file-system` is a no-op on web, so the PWA keeps the inline data URL.
 * There is no filesystem to point at there, and the picker hands us base64
 * anyway.
 */

import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { generateId } from "./db/id";

const AVATAR_DIRECTORY = "avatars";
const DATA_URL_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;

/** Web has no document directory — avatars stay inline there. */
export const supportsAvatarFiles = Platform.OS !== "web";

type PickedImage = {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
};

function avatarDirectory(): Directory {
  const directory = new Directory(Paths.document, AVATAR_DIRECTORY);

  if (!directory.exists) {
    directory.create({ intermediates: true });
  }

  return directory;
}

function extensionFor(mimeType: string | null | undefined): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
    case "image/heif":
      return "heic";
    default:
      return "jpg";
  }
}

/** True only for files this module wrote, so nothing else can be deleted by mistake. */
export function isManagedAvatarFile(uri: string | null | undefined): boolean {
  if (!uri || !supportsAvatarFiles) {
    return false;
  }

  return uri.startsWith("file://") && uri.includes(`/${AVATAR_DIRECTORY}/`);
}

/** Persists a freshly picked image and returns the value to store on the user row. */
export function persistPickedAvatar(asset: PickedImage): string {
  if (!supportsAvatarFiles) {
    if (!asset.base64) {
      throw new Error("Image could not be read.");
    }

    const mimeType = asset.mimeType?.startsWith("image/") ? asset.mimeType : "image/jpeg";

    return `data:${mimeType};base64,${asset.base64}`;
  }

  const target = new File(avatarDirectory(), `${generateId()}.${extensionFor(asset.mimeType)}`);

  new File(asset.uri).copy(target);

  return target.uri;
}

/**
 * Writes a legacy `data:` avatar out to a file, once. Returns the stored value
 * unchanged when there is nothing to migrate, so callers can compare and only
 * write the column back when it actually moved.
 */
export function migrateAvatar(stored: string | null): string | null {
  if (!stored || !supportsAvatarFiles) {
    return stored;
  }

  const match = DATA_URL_PATTERN.exec(stored);

  if (!match) {
    return stored;
  }

  const [, mimeType, base64] = match;

  try {
    const target = new File(avatarDirectory(), `${generateId()}.${extensionFor(mimeType)}`);

    target.create();
    target.write(base64, { encoding: "base64" });

    return target.uri;
  } catch {
    // Keep the inline value rather than dropping the user's photo.
    return stored;
  }
}

/** Deletes a file-backed avatar that nothing references any more. */
export function discardAvatar(uri: string | null | undefined): void {
  if (!isManagedAvatarFile(uri)) {
    return;
  }

  try {
    const file = new File(uri as string);

    if (file.exists) {
      file.delete();
    }
  } catch {
    // A missing file is already the desired state.
  }
}

/** Values accepted on the `User.avatarUrl` column. */
export function isValidAvatarValue(value: string): boolean {
  return (
    value.startsWith("data:image/") || value.startsWith("file://") || /^https?:\/\//i.test(value)
  );
}
