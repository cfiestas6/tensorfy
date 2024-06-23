import { useDisclosure } from "@chakra-ui/react"
import { FC, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"

import { hideMultisig } from "../../../shared/multisig/utils/baseMultisig"
import { useAppState } from "../../app.state"
import { routes } from "../../routes"
import { hasSavedRecoverySeedPhraseView } from "../../views/account"
import { useView } from "../../views/implementation/react"
import { Account } from "../accounts/Account"
import { autoSelectAccountOnNetwork } from "../accounts/switchAccount"
import { useIsSignerInMultisig } from "../multisig/hooks/useIsSignerInMultisig"
import { useMultisig } from "../multisig/multisig.state"
import { useIsMainnet } from "../networks/hooks/useIsMainnet"
import { AccountTokensButtons } from "./AccountTokensButtons"
import { useAddFundsDialogSend } from "./useAddFundsDialog"
import { useToken } from "./tokens.state"
import { ETH_TOKEN_ADDRESS } from "../../../shared/network/constants"
import { useBestFeeToken } from "../actions/useBestFeeToken"
import { useHasFeeTokenBalance } from "./useFeeTokenBalance"
import { usePortfolioUrl } from "../actions/hooks/usePortfolioUrl"

interface AccountTokensButtonsContainerProps {
  account: Account
  hideSend?: boolean
}

export const AccountTokensButtonsContainer: FC<
  AccountTokensButtonsContainerProps
> = ({ account }) => {
  const navigate = useNavigate()
  const { switcherNetworkId } = useAppState()
  const multisig = useMultisig(account)
  const signerIsInMultisig = useIsSignerInMultisig(multisig)
  const isMainnet = useIsMainnet()
  const bestFeeToken = useBestFeeToken(account)
  const sendToken = useToken({
    address: bestFeeToken?.address ?? ETH_TOKEN_ADDRESS,
    networkId: switcherNetworkId,
  })
  const hasFeeTokenBalance = useHasFeeTokenBalance(account)

  const hasSavedRecoverySeedPhrase = useView(hasSavedRecoverySeedPhraseView)

  const addFundsDialogSend = useAddFundsDialogSend()

  const onAddFunds = useCallback(() => {
    navigate(routes.funding())
  }, [navigate])

  const onPlugins = useCallback(() => {
    navigate(routes.addPlugin(account?.address))
  }, [account?.address, navigate])

  const showSaveRecoveryPhraseModal = useMemo(() => {
    return !hasSavedRecoverySeedPhrase && isMainnet
  }, [hasSavedRecoverySeedPhrase, isMainnet])

  const showSendButton = useMemo(() => {
    if (
      showSaveRecoveryPhraseModal ||
      (multisig && (multisig.needsDeploy || !signerIsInMultisig)) ||
      !hasFeeTokenBalance
    ) {
      return false
    }

    return Boolean(sendToken)
  }, [
    multisig,
    sendToken,
    signerIsInMultisig,
    showSaveRecoveryPhraseModal,
    hasFeeTokenBalance,
  ])
  const portfolioUrl = usePortfolioUrl(account)
  const showAddFundsButton = useMemo(() => {
    if (showSaveRecoveryPhraseModal || (multisig && !signerIsInMultisig)) {
      return false
    }

    return true
  }, [multisig, signerIsInMultisig, showSaveRecoveryPhraseModal])

  const showHideMultisigButton = useMemo(() => {
    return multisig && !signerIsInMultisig
  }, [multisig, signerIsInMultisig])

  const {
    isOpen: isHideMultisigModalOpen,
    onOpen: onHideMultisigModalOpen,
    onClose: onHideMultisigModalClose,
  } = useDisclosure()

  const onHideConfirm = useCallback(async () => {
    if (multisig) {
      await hideMultisig(multisig)
      const account = await autoSelectAccountOnNetwork(switcherNetworkId)
      onHideMultisigModalClose()
      if (account) {
        navigate(routes.accounts())
      } else {
        /** no accounts, return to empty account screen */
        navigate(routes.accountTokens())
      }
    }
  }, [multisig, navigate, onHideMultisigModalClose, switcherNetworkId])

  const onSend = () => addFundsDialogSend()

  let buttonColumnCount = 1
  if (showSendButton) {
    buttonColumnCount++
  }
  if (showSendButton && portfolioUrl) {
    buttonColumnCount++
  }

  return (
    <AccountTokensButtons
      account={account}
      onAddFunds={onAddFunds}
      showAddFundsButton={showAddFundsButton}
      showSendButton={showSendButton}
      onSend={onSend}
      onPlugins={onPlugins}
      showHideMultisigButton={showHideMultisigButton}
      onHideMultisigModalOpen={onHideMultisigModalOpen}
      onHideMultisigModalClose={onHideMultisigModalClose}
      isHideMultisigModalOpen={isHideMultisigModalOpen}
      onHideConfirm={onHideConfirm}
      portfolioUrl={portfolioUrl}
      buttonColumnCount={buttonColumnCount}
    />
  )
}
