import { z } from "zod"

export const preferencesSchema = z.object({
  value: z.string(),
  platform: z.enum(["ios", "argentx", "android"]).nullable(),
})

export type Preferences = z.infer<typeof preferencesSchema>

export const preferencesEndpointPayload = z.object({
  preferences: z.record(preferencesSchema),
})

export type PreferencesPayload = z.infer<typeof preferencesEndpointPayload>

export const emailPreferencesSchema = z.object({
  isNewsletterEnabled: z.boolean(),
  isAnnouncementsEnabled: z.boolean(),
})

export type EmailPreferences = z.infer<typeof emailPreferencesSchema>
