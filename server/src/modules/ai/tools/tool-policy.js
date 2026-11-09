import { z } from "zod";
import { TOOLS } from "./tool-registry.js";

// Which tools an actor is offered: the same role + permission rules as the routes behind them.
export const isToolAllowed = (tool, actor) => {
  if (tool.requiresAccount && actor.kind !== "account") return false;
  if (tool.roles && !tool.roles.some((role) => actor.roles.has(role))) return false;
  return tool.permissions.every((name) => actor.permissions.has(name));
};

export const toolsForActor = (actor, catalog = TOOLS) =>
  catalog.filter((tool) => isToolAllowed(tool, actor));

// OpenAI Responses API function tool. Non-strict, so optional fields stay optional; arguments are
// validated again with the zod schema before anything runs.
export const toOpenAiTool = (tool) => {
  const parameters = z.toJSONSchema(tool.schema, { io: "input" });
  delete parameters.$schema;
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters,
    strict: false,
  };
};

export const parseToolArguments = (tool, rawArguments) => {
  let value;
  try {
    value = rawArguments ? JSON.parse(rawArguments) : {};
  } catch {
    return { success: false, issues: [{ field: "", message: "Arguments are not valid JSON" }] };
  }
  const result = tool.schema.safeParse(value ?? {});
  if (!result.success) {
    return {
      success: false,
      issues: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  return { success: true, data: result.data };
};
