-- State present before the membership-plan migration: integer gym IDs, posts,
-- linked Google identities, and opaque database sessions must survive upgrades.
INSERT INTO "User" ("id", "email", "name") VALUES
  (41, 'operator@example.test', 'Fixture Operator'),
  (42, 'member@example.test', 'Fixture Member');
INSERT INTO "Post" ("id", "title", "content", "authorId") VALUES
  (73, 'Preserved gym history', 'Existing content', 41);
INSERT INTO "AuthUser" ("id", "email", "name", "emailVerified", "gymUserId") VALUES
  ('fixture-auth-admin', 'operator@example.test', 'Fixture Operator', '2026-01-01', 41),
  ('fixture-auth-member', 'member@example.test', 'Fixture Member', '2026-01-01', 42);
INSERT INTO "AuthAccount" ("id", "userId", "type", "provider", "providerAccountId") VALUES
  ('fixture-google-account', 'fixture-auth-admin', 'oauth', 'google', 'fixture-google-subject');
INSERT INTO "AuthSession" ("id", "sessionToken", "userId", "expires") VALUES
  ('fixture-admin-session', 'fixture-admin-session-token', 'fixture-auth-admin', '2099-01-01'),
  ('fixture-member-session', 'fixture-member-session-token', 'fixture-auth-member', '2099-01-01');
