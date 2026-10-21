# VinAthletics

The language of accounts, gym operations, and access within one gym organization.

## Language

**Account**:
The identity of one person within the gym organization, shared across that person's assigned roles.
_Avoid_: Membership, login method

**Assigned Role**:
A gym function a person is permitted to perform, such as member, trainer, staff, admin, or superadmin. An account can hold several assigned roles.
_Avoid_: Selected interface, membership tier

**Membership**:
A purchased entitlement to gym access under a plan's conditions. Creating an account or receiving an assigned role does not grant a membership.
_Avoid_: Account, assigned role

**Member**:
A person registered in the gym's member records, whose online account and purchased membership are separate concepts. A member record can exist before the person claims an online account.
_Avoid_: Paid member when referring to every registered person

**Walk-in Customer**:
A non-member purchasing gym access for an individual visit, without mandatory member registration.
_Avoid_: Member

**Account Invitation**:
An authorized invitation for a person to claim online access associated with a gym record or assigned role. The recipient personally proves ownership and accepts the account requirements.
_Avoid_: Shared password, preactivated account
