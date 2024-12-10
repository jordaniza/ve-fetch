import { createPublicClient, http, type Address } from "viem";
import { mode } from "viem/chains";
import { VotingEscrowAbi } from "./abis/VotingEscrowIncreasing";
import { multicall } from "viem/actions";
import { getAbiItem } from "viem";
import fs from "fs";
import { LockAbi } from "./abis/Lock";

type LockedResult = {
  tokenId: bigint;
  result: { amount: string; start: number };
};

type OwnerResult = {
  tokenId: bigint;
  result: Address;
};

type AccountInfo = {
  [address: string]: {
    tokenIds: { id: string; locked: string }[];
    totalLocked: string;
  };
};

const client = createPublicClient({
  chain: mode,
  transport: http("https://mainnet.mode.network/"),
});

// Smart contract details
export const modeEscrow = "0xff8AB822b8A853b01F9a9E9465321d6Fe77c9D2F";
export const bptEscrow = "0x9c2eFe2a1FBfb601125Bb07a3D5bC6EC91F91e01";
export const DepositEvent = getAbiItem({
  abi: VotingEscrowAbi,
  name: "Deposit",
});

const serializer = (_: string, value: any) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

async function getLatestTokenId(contract: Address) {
  return await client.readContract({
    address: contract,
    abi: VotingEscrowAbi,
    functionName: "lastLockId",
  });
}
async function getLockContract(esrow: Address) {
  return await client.readContract({
    address: esrow,
    abi: VotingEscrowAbi,
    functionName: "lockNFT",
  });
}

// Initialize the client
async function executeMulticalls(calls: any[], batchSize = 500) {
  const batches = [];

  // Split calls into batches
  for (let i = 0; i < calls.length; i += batchSize) {
    const batch = calls.slice(i, i + batchSize);
    batches.push(batch);
  }

  const results = [];
  for (const batch of batches) {
    // log batch x of y
    console.log(
      `Fetching batch ${batches.indexOf(batch) + 1} of ${batches.length}`,
    );
    const multi = await multicall(client, {
      contracts: batch,
      allowFailure: true,
    });
    // map the voter power to the Address
    const result = multi.map((m, index) => ({
      tokenId: batch[index].args[0],
      result: m.result,
    }));
    results.push(result);
  }

  // Flatten results into a single array
  return results.flat();
}

function getLockedCalls(lastId: bigint, escrow: Address) {
  const ids = Array.from({ length: Number(lastId) }, (_, i) => BigInt(i + 1));
  return ids.map((id) => ({
    address: escrow,
    abi: VotingEscrowAbi,
    functionName: "locked",
    args: [id],
  }));
}

function getOwnerCalls(lastId: bigint, lock: Address) {
  // ids start from 1
  const ids = Array.from({ length: Number(lastId) }, (_, i) => BigInt(i + 1));
  return ids.map((id) => ({
    address: lock,
    abi: LockAbi,
    functionName: "ownerOf",
    args: [id],
  }));
}

async function getData(contract: Address) {
  const name = contract === modeEscrow ? "mode" : "bpt";
  const tokenId = await getLatestTokenId(contract);
  const lockedCalls = getLockedCalls(tokenId, contract);
  const lock = await getLockContract(contract);
  const ownerCalls = getOwnerCalls(tokenId, lock);

  console.log(`Fetching ${lockedCalls.length} locked results for ${name}`);
  const lockedResults = await executeMulticalls(lockedCalls);
  console.log(`Fetching ${ownerCalls.length} owner results for ${name}`);
  const ownerResults = await executeMulticalls(ownerCalls);

  const accountInfo = groupByAddress(
    lockedResults as any,
    ownerResults as any,
    contract,
  );
  fs.writeFileSync(
    `${name}_account_info.json`,
    JSON.stringify(accountInfo, serializer, 2),
  );
}

function groupByAddress(
  lockedResults: LockedResult[],
  ownerResults: OwnerResult[],
  escrow: Address,
): AccountInfo {
  const accountInfo: AccountInfo = {};

  // Create a Map for owner lookup by tokenId
  const ownerMap = new Map(
    ownerResults.map(({ tokenId, result }) => [tokenId, result]),
  );

  // Process locked results
  for (const { tokenId, result } of lockedResults) {
    const address = ownerMap.get(tokenId); // Find the owner of the tokenId
    if (!address) continue; // Skip if no owner is found
    if (address.toLowerCase() === escrow.toLowerCase()) continue; // Skip if the owner is the escrow contract

    // Initialize account info for the address if not already present
    if (!accountInfo[address]) {
      accountInfo[address] = { tokenIds: [], totalLocked: "0" };
    }

    // Add token and locked amount to the account info
    accountInfo[address].tokenIds.push({
      id: tokenId.toString(),
      locked: result.amount,
    });

    // Accumulate the total locked amount
    accountInfo[address].totalLocked = (
      BigInt(accountInfo[address].totalLocked) + BigInt(result.amount)
    ).toString();
  }

  return accountInfo;
}
console.warn("Data fetching is turned off. Enable by uncommenting the code.");
// await Promise.all([getData(modeEscrow), getData(bptEscrow)]);
function makeLeaderboard(name: "mode" | "bpt") {
  const file = fs.readFileSync(`${name}_account_info.json`, "utf-8");
  const data = JSON.parse(file);

  const leaderboard = Object.entries(data).map(([address, data]) => {
    return {
      address,
      totalStaked: BigInt(data.totalLocked),
      veNFTs: data.tokenIds.map((t) => t.id),
    };
  });

  leaderboard.sort((a, b) => (b.totalStaked > a.totalStaked ? 1 : -1));

  // rank them
  leaderboard.forEach((item, index) => {
    item.rank = index + 1;
  });
  fs.writeFileSync(
    `${name}_leaderboard.json`,
    JSON.stringify({ [name]: leaderboard }, serializer, 2),
  );
}
makeLeaderboard("mode");
makeLeaderboard("bpt");
