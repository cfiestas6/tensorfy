import { z } from "zod"

import { extensionOnlyProcedure } from "../permissions"
import { baseWalletAccountSchema } from "../../../../shared/wallet.model"
import { AccountMessagingError } from "../../../../shared/errors/accountMessaging"
import { getEntryPointSafe } from "../../../../shared/utils/transactions"

const triggerEscapeGuardianSchema = z.object({
  account: baseWalletAccountSchema,
})

export const triggerEscapeGuardianProcedure = extensionOnlyProcedure
  .input(triggerEscapeGuardianSchema)
  .mutation(
    async ({
      input: { account },
      ctx: {
        services: { actionService, wallet },
      },
    }) => {
      try {
        const starknetAccount = await wallet.getSelectedStarknetAccount()

        await actionService.add(
          {
            type: "TRANSACTION",
            payload: {
              transactions: {
                contractAddress: account.address,
                entrypoint: getEntryPointSafe(
                  "triggerEscapeGuardian",
                  starknetAccount.cairoVersion,
                ),
                calldata: [],
              },
              meta: {
                isCancelEscape: true,
                title: "Trigger escape guardian",
                type: "INVOKE",
              },
            },
          },
          {
            title: "Trigger escape guardian",
            origin,
          },
        )
      } catch (error) {
        throw new AccountMessagingError({
          options: { error },
          code: "TRIGGER_ESCAPE_FAILED",
        })
      }
    },
  )
