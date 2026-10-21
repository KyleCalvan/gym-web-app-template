# Share database sessions across Google and password authentication

The installed NextAuth v4 credentials flow issues JWTs, while S01 must retain revocable database sessions and the existing Google integration. Keep Google's NextAuth flow and add an application-owned session service used through adapter methods by Google and directly by password endpoints, sharing storage, an explicit cookie policy, and authorization gates rather than changing to JWT sessions or patching private NextAuth internals.

A recognized identity session may remain restricted while email verification, onboarding, terms acceptance, or required authenticator enrollment/challenge is incomplete. Every business API must enforce the persisted account requirements and the specific session's assurance; client session status and selected interface are insufficient. Password cookie issuance is application-owned compatibility behavior and must be integration-tested with the installed NextAuth version and on upgrades.
