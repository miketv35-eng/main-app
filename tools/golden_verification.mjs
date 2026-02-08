import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

console.log("🏆 Starting Golden Verification Protocol...");

let steps = [
    { name: "Environment Variables", check: () => process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY && process.env.ANTHROPIC_API_KEY },
    { name: "Supabase Connection", command: "node tools/verify_supabase.js" },
    { name: "Anthropic API", command: "node tools/verify_anthropic.mjs" },
    { name: "Build Check", command: "npm run build" }
];

let failed = false;

for (let step of steps) {
    process.stdout.write(`[...] Checking ${step.name}... `);
    try {
        if (step.check) {
            if (!step.check()) throw new Error("Missing Environment Variables");
        }
        if (step.command) {
            execSync(step.command, { stdio: 'pipe' });
        }
        console.log("✅ PASS");
    } catch (error) {
        console.log("❌ FAIL");
        console.error(`Error in ${step.name}:`, error.message);
        if (error.stdout) console.log(error.stdout.toString());
        if (error.stderr) console.error(error.stderr.toString());
        failed = true;
        break;
    }
}

if (failed) {
    console.log("\n⛔ Golden Verification FAILED. Fix issues before deploying.");
    process.exit(1);
} else {
    console.log("\n✨ Golden Verification PASSED. System is ready for launch.");
    process.exit(0);
}
