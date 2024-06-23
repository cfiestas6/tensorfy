import { ArgentBackendNftService } from "@argent/x-shared"
import { networkService } from "../network/service"
import {
  nftsCollectionsRepository,
  nftsContractsRepository,
  nftsRepository,
} from "../storage/__new/repositories/nft"
import { NFTService } from "./implementation"
import { ARGENT_API_BASE_URL } from "../api/constants"
import { settingsStore } from "../settings/store"

export const argentNftService = new ArgentBackendNftService(
  ARGENT_API_BASE_URL,
  {
    headers: {
      "argent-version": process.env.VERSION ?? "Unknown version",
      "argent-client": "argent-x",
    },
  },
)

export const nftService = new NFTService(
  networkService,
  nftsRepository,
  nftsCollectionsRepository,
  nftsContractsRepository,
  argentNftService,
  settingsStore,
)
