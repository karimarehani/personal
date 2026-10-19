import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const profileStates = sqliteTable('profile_states', {
  id: text('id').primaryKey(),
  state: text('state').notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
export const phoneSessions = sqliteTable('phone_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  profileId: text('profile_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const otpLimits = sqliteTable('otp_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  expiresAt: integer('expires_at').notNull(),
});
export const projectAccounts = sqliteTable('project_accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull().unique(),
  position: text('position').notNull(),
  civ: text('civ').notNull(),
  passwordSalt: text('password_salt').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
});
