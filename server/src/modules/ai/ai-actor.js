import { actorRoleNames } from "../role-permission/role-permission-scope.js";
import { ACTOR_SCOPE, KNOWLEDGE_AUDIENCE } from "./ai.constants.js";

// The assistant acts with the chatting person's own rights. An actor is built from the same
// serialized account the permission middleware uses (auth.service getCurrentAccount), so a custom
// role counts as its base role exactly as requireRole does.

export const GUEST_ACTOR = Object.freeze({
  kind: "guest",
  accountId: null,
  roles: new Set(),
  permissions: new Set(),
  displayName: null,
});

export const actorFromAccount = (account) => ({
  kind: "account",
  accountId: account.id,
  roles: actorRoleNames(account.roles ?? []),
  permissions: new Set((account.permissions ?? []).map(({ name }) => name)),
  displayName: account.profile?.fullName || account.username || null,
});

const SCOPE_PRIORITY = [ACTOR_SCOPE.ADMIN, ACTOR_SCOPE.MANAGER, ACTOR_SCOPE.STAFF, ACTOR_SCOPE.CUSTOMER];

export const actorScope = (actor) => {
  if (actor.kind !== "account") return ACTOR_SCOPE.GUEST;
  return SCOPE_PRIORITY.find((role) => actor.roles.has(role)) ?? ACTOR_SCOPE.CUSTOMER;
};

export const isInternalActor = (actor) =>
  [ACTOR_SCOPE.ADMIN, ACTOR_SCOPE.MANAGER, ACTOR_SCOPE.STAFF].includes(actorScope(actor));

// Customers and guests never retrieve internal knowledge chunks.
export const knowledgeAudiences = (actor) =>
  isInternalActor(actor)
    ? [KNOWLEDGE_AUDIENCE.PUBLIC, KNOWLEDGE_AUDIENCE.INTERNAL]
    : [KNOWLEDGE_AUDIENCE.PUBLIC];
