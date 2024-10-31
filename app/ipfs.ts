import { fromHex, type Hex } from "viem";
import type { Metadata } from "./types";

const IPFS_FETCH_TIMEOUT = 10000; // 10 seconds
const PUB_IPFS_ENDPOINTS =
  "https://externalorgs.mypinata.cloud/ipfs,https://ipfs.io/ipfs";

export async function fetchIpfsAsJson(ipfsUri: string): Promise<Metadata> {
  const res = await fetchRawIpfs(ipfsUri);
  return await res.json();
}

export async function fetchRawIpfs(ipfsUri: string): Promise<Response> {
  if (!ipfsUri) throw new Error("Invalid IPFS URI");
  else if (ipfsUri.startsWith("0x")) {
    // Convert hex string to UTF-8
    ipfsUri = fromHex(ipfsUri as Hex, "string");
    if (!ipfsUri) throw new Error("Invalid IPFS URI after hex conversion");
  }

  const uriPrefixes = PUB_IPFS_ENDPOINTS.split(",").filter(
    (uri) => !!uri.trim(),
  );
  if (!uriPrefixes.length)
    throw new Error("No available IPFS endpoints to fetch from");

  const cid = resolvePath(ipfsUri);

  for (const uriPrefix of uriPrefixes) {
    const controller = new AbortController();
    const abortId = setTimeout(() => controller.abort(), IPFS_FETCH_TIMEOUT);
    try {
      const response = await fetch(`${uriPrefix}/${cid}`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(abortId);
      if (!response.ok) continue;
      return response;
    } catch (error) {
      clearTimeout(abortId);
      continue;
    }
  }

  throw new Error("Could not connect to any of the IPFS endpoints");
}

function resolvePath(uri: string) {
  return uri.startsWith("ipfs://") ? uri.slice(7) : uri;
}
