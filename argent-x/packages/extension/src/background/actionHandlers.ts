import { stark } from "starknet"

import { accountService } from "../shared/account/service"
import { ExtensionActionItem } from "../shared/actionQueue/types"
import { MessageType } from "../shared/messages"
import { networkService } from "../shared/network/service"
import { isEqualWalletAddress } from "../shared/wallet.service"
import { assertNever } from "../shared/utils/assertNever"
import { accountDeployAction } from "./accountDeployAction"

import { addMultisigDeployAction } from "./multisig/multisigDeployAction"
import { openUi } from "./openUi"
import {
  TransactionAction,
  executeTransactionAction,
} from "./transactions/transactionExecution"
import { udcDeclareContract, udcDeployContract } from "./udcAction"
import { Wallet } from "./wallet"
import { preAuthorizationService } from "../shared/preAuthorization/service"
import { networkSchema } from "../shared/network"
import { encodeChainId } from "../shared/utils/encodeChainId"
import { IFeeTokenService } from "../shared/feeToken/service/interface"
import { analyticsService } from "../shared/analytics"

const handleTransactionAction = async ({
  action,
  wallet,
}: {
  action: TransactionAction
  networkId: string
  wallet: Wallet
}): Promise<MessageType> => {
  const actionHash = action.meta.hash

  try {
    const response = await executeTransactionAction(action, wallet)

    return {
      type: "TRANSACTION_SUBMITTED",
      data: { txHash: response.transaction_hash, actionHash },
    }
  } catch (error) {
    return {
      type: "TRANSACTION_FAILED",
      data: { actionHash, error: `${error}` },
    }
  }
}
export const handleActionApproval = async (
  action: ExtensionActionItem,
  wallet: Wallet,
  feeTokenService: IFeeTokenService,
): Promise<MessageType | undefined> => {
  const actionHash = action.meta.hash
  const selectedAccount = await wallet.getSelectedAccount()
  const networkId = selectedAccount?.networkId || "unknown"

  switch (action.type) {
    case "CONNECT_DAPP": {
      const { host } = action.payload

      if (!selectedAccount) {
        void openUi()
        return
      }

      await preAuthorizationService.add({
        account: selectedAccount,
        host,
      })
      analyticsService.dappPreauthorized({
        host,
      })
      return { type: "CONNECT_DAPP_RES", data: selectedAccount }
    }

    case "TRANSACTION": {
      return handleTransactionAction({
        action,
        networkId,
        wallet,
      })
    }

    case "DEPLOY_ACCOUNT": {
      try {
        const txHash = await accountDeployAction(
          action,
          wallet,
          feeTokenService,
        )

        return {
          type: "DEPLOY_ACCOUNT_ACTION_SUBMITTED",
          data: { txHash, actionHash },
        }
      } catch (exception) {
        let error = `${exception}`
        if (error.includes("403")) {
          error = `${error}\n\nA 403 error means there's already something running on the selected port. On macOS, AirPlay is using port 5000 by default, so please try running your node on another port and changing the port in Argent X settings.`
        }

        return {
          type: "DEPLOY_ACCOUNT_ACTION_FAILED",
          data: { actionHash, error: `${error}` },
        }
      }
    }

    case "DEPLOY_MULTISIG": {
      try {
        await addMultisigDeployAction(action, wallet)

        break
      } catch (exception) {
        let error = `${exception}`
        console.error(error)
        if (error.includes("403")) {
          error = `${error}\n\nA 403 error means there's already something running on the selected port. On macOS, AirPlay is using port 5000 by default, so please try running your node on another port and changing the port in Argent X settings.`
        }

        break
      }
    }

    case "SIGN": {
      const { typedData } = action.payload
      if (!(await wallet.isSessionOpen())) {
        throw new Error("you need an open session")
      }
      const starknetAccount = await wallet.getSelectedStarknetAccount()
      const selectedAccount = await wallet.getSelectedAccount()

      if (!selectedAccount) {
        return {
          type: "SIGNATURE_FAILURE",
          data: {
            error: "No selected account",
            actionHash,
          },
        }
      }

      // let's compare encoded formats of both chainIds
      const encodedDomainChainId = encodeChainId(typedData.domain.chainId)
      const encodedSelectedChainId = encodeChainId(
        selectedAccount.network.chainId,
      )
      // typedData.domain.chainId is optional, so we need to check if it exists
      if (
        encodedDomainChainId &&
        encodedSelectedChainId !== encodedDomainChainId
      ) {
        return {
          type: "SIGNATURE_FAILURE",
          data: {
            error: `Cannot sign the message from a different chainId. Expected ${encodedSelectedChainId}, got ${encodedDomainChainId}`,
            actionHash,
          },
        }
      }

      try {
        const signature = await starknetAccount.signMessage(typedData)
        const formattedSignature = stark.signatureToDecimalArray(signature)

        return {
          type: "SIGNATURE_SUCCESS",
          data: {
            signature: formattedSignature,
            actionHash,
          },
        }
      } catch (error) {
        console.error(error)
        return {
          type: "SIGNATURE_FAILURE",
          data: {
            error: `${error}`,
            actionHash,
          },
        }
      }
    }

    case "REQUEST_TOKEN": {
      return {
        type: "APPROVE_REQUEST_TOKEN",
        data: { actionHash },
      }
    }

    case "REQUEST_ADD_CUSTOM_NETWORK": {
      try {
        const parsedNetwork = networkSchema.parse(action.payload)
        await networkService.add(parsedNetwork)
        return {
          type: "APPROVE_REQUEST_ADD_CUSTOM_NETWORK",
          data: { actionHash },
        }
      } catch (error) {
        return {
          type: "REJECT_REQUEST_ADD_CUSTOM_NETWORK",
          data: { actionHash },
        }
      }
    }

    case "REQUEST_SWITCH_CUSTOM_NETWORK": {
      try {
        const { chainId } = action.payload

        const network = await networkService.getByChainId(chainId)

        if (!network) {
          throw Error(`Network with chainId ${chainId} not found`)
        }

        const accountsOnNetwork = await accountService.get((account) => {
          return account.networkId === network.id && !account.hidden
        })

        if (!accountsOnNetwork.length) {
          throw Error(`No accounts found on network with chainId ${chainId}`)
        }

        const currentlySelectedAccount = await wallet.getSelectedAccount()

        const existingAccountOnNetwork =
          currentlySelectedAccount &&
          accountsOnNetwork.find((account) =>
            isEqualWalletAddress(account, currentlySelectedAccount),
          )

        const selectedAccount = await wallet.selectAccount(
          existingAccountOnNetwork ?? accountsOnNetwork[0],
        )

        if (!selectedAccount) {
          throw Error(`No accounts found on network with chainId ${chainId}`)
        }

        return {
          type: "APPROVE_REQUEST_SWITCH_CUSTOM_NETWORK",
          data: { actionHash, selectedAccount },
        }
      } catch (error) {
        return {
          type: "REJECT_REQUEST_SWITCH_CUSTOM_NETWORK",
          data: { actionHash },
        }
      }
    }

    case "DECLARE_CONTRACT": {
      try {
        const { classHash, txHash } = await udcDeclareContract(action, wallet)
        return {
          type: "DECLARE_CONTRACT_ACTION_SUBMITTED",
          data: { txHash, actionHash, classHash },
        }
      } catch (exception) {
        let error = `${exception}`
        if (error.includes("403")) {
          error = `${error}\n\nA 403 error means there's already something running on the selected port. On macOS, AirPlay is using port 5000 by default, so please try running your node on another port and changing the port in Argent X settings.`
        }

        return {
          type: "DECLARE_CONTRACT_ACTION_FAILED",
          data: { actionHash, error: `${error}` },
        }
      }
    }

    case "DEPLOY_CONTRACT": {
      try {
        const { txHash, contractAddress } = await udcDeployContract(
          action,
          wallet,
        )

        return {
          type: "DEPLOY_CONTRACT_ACTION_SUBMITTED",
          data: {
            txHash,
            deployedContractAddress: contractAddress,
            actionHash,
          },
        }
      } catch (exception) {
        let error = `${exception}`
        if (error.includes("403")) {
          error = `${error}\n\nA 403 error means there's already something running on the selected port. On macOS, AirPlay is using port 5000 by default, so please try running your node on another port and changing the port in Argent X settings.`
        }

        return {
          type: "DEPLOY_CONTRACT_ACTION_FAILED",
          data: { actionHash, error: `${error}` },
        }
      }
    }

    default:
      assertNever(action)
  }
}

export const handleActionRejection = async (
  action: ExtensionActionItem,
): Promise<MessageType | undefined> => {
  const actionHash = action.meta.hash

  switch (action.type) {
    case "CONNECT_DAPP": {
      return {
        type: "REJECT_PREAUTHORIZATION",
        data: {
          host: action.payload.host,
          actionHash,
        },
      }
    }

    case "TRANSACTION": {
      return {
        type: "TRANSACTION_FAILED",
        data: { actionHash },
      }
    }

    case "DEPLOY_ACCOUNT": {
      return {
        type: "DEPLOY_ACCOUNT_ACTION_FAILED",
        data: { actionHash },
      }
    }

    case "DEPLOY_MULTISIG": {
      break
    }

    case "SIGN": {
      return {
        type: "SIGNATURE_FAILURE",
        data: { actionHash, error: "User rejected" },
      }
    }

    case "REQUEST_TOKEN": {
      return {
        type: "REJECT_REQUEST_TOKEN",
        data: { actionHash },
      }
    }

    case "REQUEST_ADD_CUSTOM_NETWORK": {
      return {
        type: "REJECT_REQUEST_ADD_CUSTOM_NETWORK",
        data: { actionHash },
      }
    }

    case "REQUEST_SWITCH_CUSTOM_NETWORK": {
      return {
        type: "REJECT_REQUEST_SWITCH_CUSTOM_NETWORK",
        data: { actionHash },
      }
    }

    case "DECLARE_CONTRACT": {
      return {
        type: "REQUEST_DECLARE_CONTRACT_REJ",
        data: { actionHash },
      }
    }
    case "DEPLOY_CONTRACT": {
      return {
        type: "REQUEST_DEPLOY_CONTRACT_REJ",
        data: { actionHash },
      }
    }

    /* TODO: add deploy */

    default:
      assertNever(action)
  }
}
