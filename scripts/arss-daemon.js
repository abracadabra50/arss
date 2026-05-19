#!/usr/bin/env node
import { Command } from "commander";
import { DEFAULT_ARSS_INBOX, runDaemonLoop, runDaemonOnce } from "../src/arss/daemon.js";
import { DEFAULT_ARSS_STORE } from "../src/arss/store.js";

const program = new Command();
program.name("arss-daemon").description("Background ARSS subscriber poller and agent inbox writer").version("0.2.0");

program
    .option("--store <dir>", "ARSS subscription store", DEFAULT_ARSS_STORE)
    .option("--inbox <dir>", "delivery inbox directory", DEFAULT_ARSS_INBOX)
    .option("--interval <seconds>", "poll interval seconds", "900")
    .option("--max-chars <n>", "max characters per chunk", "1200")
    .option("--once", "run one poll cycle and exit")
    .option("--all", "redeliver all indexed chunks, ignoring previous daemon state")
    .option("--verbose", "log each cycle")
    .action(async opts => {
        const common = {
            store_dir: opts.store,
            inbox_dir: opts.inbox,
            max_chars: Number(opts.maxChars),
            since_all: Boolean(opts.all),
            verbose: Boolean(opts.verbose),
        };
        if (opts.once) {
            const result = await runDaemonOnce(common);
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        await runDaemonLoop({ ...common, interval_ms: Number(opts.interval) * 1000 });
    });

program.parse(process.argv);
