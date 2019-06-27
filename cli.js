#!/usr/bin/env node

const argv = require("yargs")
  .usage("Usage: $0 [options] <url>")
  .command(
    "$0 <url>",
    "Send the robots!",
    yargs => {
      yargs
        .option("debug", {
          type: "boolean",
          default: false
        })
        .option("dsn", {})
        .option("build-id", {})
        .option("screenshots", {})
        .option("concurrency", {
          alias: "c"
        });
    },
    argv => {
      const fs = require("fs");
      const URL = require("url").URL;
      const os = require("os");

      const Crawler = require("./lib/crawler");
      const Proxy = require("./lib/proxy");

      (async () => {
        const initialUrl = argv.url;
        const screenshots = argv.screenshots || null;

        if (screenshots) {
          try {
            fs.statSync(screenshots);
          } catch (err) {
            fs.mkdirSync(screenshots, { recursive: true });
          }
        }

        const maxConcurrency = argv.concurrency || os.cpus().length - 1;
        const allowedDomains = [
          new URL(initialUrl).host
            .split(".")
            .slice(-2)
            .join(".")
        ];

        const proxy = new Proxy({
          url: initialUrl,
          dsn: argv.dsn,
          buildId: argv.buildId,
          debug: argv.debug,
          domains: allowedDomains
        });

        const crawler = new Crawler({
          domains: allowedDomains,
          proxy: proxy.address(),
          maxConcurrency,
          screenshots,
          headless: !argv.debug,
          formConfigs: [
            {
              url: /\/auth\/login\/([^\/]+\/)?$/i,
              fields: {
                "#id_username": argv.username,
                "#id_password": argv.password
              },
              submitElement: "button[type=submit]"
            }
          ]
        });

        try {
          console.log("Automating Humans...");
          console.log(`-> screenshots: ${screenshots}`);
          console.log(`-> maxConcurrency: ${maxConcurrency}`);
          console.log(`-> initialUrl: ${initialUrl}`);
          console.log(`-> allowedDomains: ${allowedDomains}`);
          console.log(`-> proxy: ${proxy.address()}`);
          console.log("");

          await proxy.init();
          await crawler.init();
          await crawler.queue(initialUrl);
          await crawler.onIdle();
          await crawler.close();
        } finally {
          await proxy.close();
          await crawler.close();
        }
        const errors = crawler.errors();
        if (errors.length) {
          console.error(`There were ${errors.length} error(s) encountered:`);
          errors.forEach(([url, error]) => {
            console.error(`  ${url}: ${error}`);
          });
          process.exit(1);
        }
      })().catch(err => {
        console.error(err);
        process.exit(1);
      });
    }
  ).argv;
