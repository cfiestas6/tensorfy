import { CellStack } from "@argent/x-ui"
import { ComponentProps } from "react"

import { TransactionReviewSimulation } from "@argent-x/extension/src/ui/features/actions/transactionV2/simulation/TransactionReviewSimulation"

import mintNft from "@argent-x/extension/src/shared/transactionReview/__fixtures__/mint-nft.json"
import nonNativeJediswap from "@argent-x/extension/src/shared/transactionReview/__fixtures__/non-native-jediswap.json"
import sendNftSelf from "@argent-x/extension/src/shared/transactionReview/__fixtures__/send-nft-self.json"
import sendNft from "@argent-x/extension/src/shared/transactionReview/__fixtures__/send-nft.json"
import send from "@argent-x/extension/src/shared/transactionReview/__fixtures__/send.json"
import swap from "@argent-x/extension/src/shared/transactionReview/__fixtures__/swap.json"

export default {
  component: TransactionReviewSimulation,
  render: (props: ComponentProps<typeof TransactionReviewSimulation>) => (
    <CellStack>
      <TransactionReviewSimulation {...props}></TransactionReviewSimulation>
    </CellStack>
  ),
}

export const NonNativeJediswap = {
  args: {
    simulation: nonNativeJediswap.transactions[0].simulation,
  },
}

export const MintNFT = {
  args: {
    simulation: mintNft.transactions[0].simulation,
  },
}

export const SendNft = {
  args: {
    simulation: sendNft.transactions[0].simulation,
  },
}

export const SendNftSelf = {
  args: {
    simulation: sendNftSelf.transactions[0].simulation,
  },
}

export const Send = {
  args: {
    simulation: send.transactions[0].simulation,
  },
}

export const Swap = {
  args: {
    simulation: swap.transactions[0].simulation,
  },
}

export const Empty = {
  args: {},
}
