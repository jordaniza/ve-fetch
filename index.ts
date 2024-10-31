import { createPublicClient, http, type Address } from "viem";
import { mode } from "viem/chains";
import SimpleGaugeVoterABI from "./abis/SimpleGaugeVoter";
import { getGauges } from "./app/getGauges";
import { getVotes } from "./app/getVotes";

// Initialize the client
const client = createPublicClient({
  chain: mode,
  transport: http("https://mainnet.mode.network/"),
});

// Smart contract details
export const modeVoterAddress = "0x71439Ae82068E19ea90e4F506c74936aE170Cf58";
const bptVoterAddress = "0x2aA8A5C1Af4EA11A1f1F10f3b73cfB30419F77Fb";
export const abi = SimpleGaugeVoterABI;

// Process command line arguments
const args = process.argv.slice(2);
const skipFetch = args.includes("--skip");

await getGauges(client, skipFetch, modeVoterAddress);
await getVotes(client, modeVoterAddress);
await getVotes(client, bptVoterAddress);
