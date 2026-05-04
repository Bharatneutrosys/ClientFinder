import "dotenv/config";
import { runCollectorCli } from "./src/cli.js";

await runCollectorCli(process.argv.slice(2));