import { RG_CONTESTANTS } from "./points-store.mjs?v=points-console-20261120-v1";

export const POINTS_HELP = "help - clear - points [faroe|erin|kaz] - points add <name> [amount] - points set <name> <total> - points reset [name] - smeemo start|draw|reset";

function parseName(value) {
  const name = String(value || "").trim().replace(/^@/, "").toLowerCase();
  return RG_CONTESTANTS.includes(name) ? name : null;
}

function parseWholeNumber(value, { positive = false } = {}) {
  if (!/^\d+$/.test(String(value ?? ""))) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || (positive && number < 1)) return null;
  return number;
}

export function parsePointsCommand(rawCommand) {
  const command = String(rawCommand || "").trim();
  if (!command) return { action: "noop" };
  const [verb, ...args] = command.split(/\s+/);
  const action = verb.toLowerCase();
  if (action === "help") return args.length ? { action: "error" } : { action: "help" };
  if (action === "clear") return args.length ? { action: "error" } : { action: "clear" };
  if (action === "smeemo") {
    if (args.length !== 1) return { action: "error", message: "Use: smeemo start, smeemo draw, or smeemo reset." };
    const subcommand = args[0].toLowerCase();
    return ["start", "draw", "reset"].includes(subcommand)
      ? { action: `smeemo-${subcommand}` }
      : { action: "error", message: "Use: smeemo start, smeemo draw, or smeemo reset." };
  }
  if (action !== "points") return { action: "error", message: `Unknown command: ${verb}. Type help.` };
  if (!args.length) return { action: "inspect-all" };

  const [subcommand, ...rest] = args;
  const normalized = subcommand.toLowerCase();
  if (normalized === "add") {
    if (rest.length < 1 || rest.length > 2) return { action: "error" };
    const name = parseName(rest[0]);
    const amount = rest.length === 1 ? 1 : parseWholeNumber(rest[1], { positive: true });
    return name && amount !== null ? { action: "add", name, amount } : { action: "error" };
  }
  if (normalized === "set") {
    if (rest.length !== 2) return { action: "error" };
    const name = parseName(rest[0]);
    const total = parseWholeNumber(rest[1]);
    return name && total !== null ? { action: "set", name, total } : { action: "error" };
  }
  if (normalized === "reset") {
    if (rest.length > 1) return { action: "error" };
    if (!rest.length) return { action: "reset", name: null };
    const name = parseName(rest[0]);
    return name ? { action: "reset", name } : { action: "error" };
  }
  if (rest.length) return { action: "error" };
  const name = parseName(subcommand);
  return name ? { action: "inspect", name } : { action: "error" };
}
