# Use authenticator apps for two-step verification

S01 replaces the simulated email-code second step with authenticator-app codes and single-use recovery codes, while email remains responsible for address verification and password recovery. Two-step verification is required for staff, admin, and superadmin operations after either Google or password sign-in, and is optional for members and trainers. This adds authenticator enrollment and recovery responsibilities in exchange for keeping the second step separate from the mailbox used for password recovery.

Until required enrollment or an enabled challenge is complete, a recognized identity session permits only explicitly allowed completion/status/logout operations. Once enabled, two-step verification protects every assigned interface; a password reset does not remove or bypass it.

Trainer enrollment became optional because the trainer interface is now in use while authenticator enrollment is not yet implemented. A trainer who has enabled two-step verification must still complete its challenge for each session. An account that also has a staff, admin, or superadmin role still requires enrollment.
