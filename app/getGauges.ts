import { type Address } from "viem";
import fs from "fs";
import path from "path";
import { fetchIpfsAsJson } from "./ipfs";
import type { GaugeInfo } from "./types";
import { abi } from "..";

export async function getGauges(
  client: any,
  skipFetch: boolean,
  voterAddress: Address,
) {
  try {
    // Define the path for 'gauges.json'
    const gaugesFilePath = path.join(process.cwd(), "gauges.json");

    // Check if 'gauges.json' exists and skipFetch is not set
    if (!skipFetch && fs.existsSync(gaugesFilePath)) {
      console.log("Gauges data already exists");
      return;
    }

    // Get the list of gauges from the contract
    const gauges: Address[] = (await client.readContract({
      address: voterAddress,
      abi,
      functionName: "getAllGauges",
    })) as Address[];

    // Fetch gauge data and metadata sequentially
    const gaugeInfos: GaugeInfo[] = [];

    for (const gaugeAddress of gauges) {
      console.log(`Fetching data for gauge: ${gaugeAddress}`);
      // Read the gauge data
      const gaugeData = (await client.readContract({
        address: voterAddress,
        abi: abi,
        functionName: "gauges",
        args: [gaugeAddress],
      })) as [number, string, string];

      // Extract the IPFS URI (adjust the index based on your actual data structure)
      const ipfsURI = gaugeData[2];

      // Fetch the metadata from IPFS
      const metadata = await fetchIpfsAsJson(ipfsURI);

      // Create the GaugeInfo object
      const gaugeInfo: GaugeInfo = {
        address: gaugeAddress,
        ipfsURI: ipfsURI,
        metadata: metadata,
      };

      // Add to the array
      gaugeInfos.push(gaugeInfo);
    }

    // Write the data to 'gauges.json'
    fs.writeFileSync(gaugesFilePath, JSON.stringify(gaugeInfos, null, 2));

    // Output the JSON blob
  } catch (error) {
    console.error("Error:", error);
  }
}
