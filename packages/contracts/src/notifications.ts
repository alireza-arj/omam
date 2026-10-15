import { z } from "zod";
import { languageSchema } from "./common";

export const pushEndpointSchema = z.string().url().max(2048).refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && !url.port && (
    ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname) ||
    url.hostname.endsWith(".push.apple.com") || url.hostname.endsWith(".notify.windows.com")
  );
});

export const pushSubscriptionInputSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/),
  }),
  deviceId: z.string().min(1).max(200),
  language: languageSchema,
});

export const removePushSubscriptionInputSchema = z.object({ endpoint: pushEndpointSchema });
export type PushSubscriptionInputDto = z.infer<typeof pushSubscriptionInputSchema>;
export type PushConfigurationDto = { publicKey: string | null };
