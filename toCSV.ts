import fs from "fs";

import mode from "./temp/input/mode-1435.json";
import bpt from "./temp/input/bpt-1435.json";

// Extract data and flatten it
function toCSV(name: string, json: typeof mode | typeof bpt) {
  const rows = [] as any[];

  json.data.forEach((item) => {
    item.votes.forEach((vote) => {
      rows.push({
        gauge: item.gauge,
        votingContract: item.votingContract,
        epoch: item.epoch,
        title: item.title,
        voter: vote.voter,
        votes: vote.votes,
      });
    });
  });

  // Build the CSV
  const headers = [
    "gauge",
    "votingContract",
    "epoch",
    "title",
    "voter",
    "votes",
  ];
  const csv = [
    headers.join(","), // Add headers
    ...rows.map((row) => headers.map((header) => row[header]).join(",")), // Add rows
  ].join("\n");

  // Write to a file
  fs.writeFileSync(`./temp/${name}-output.csv`, csv);
}

toCSV("mode", mode);
toCSV("bpt", bpt);
