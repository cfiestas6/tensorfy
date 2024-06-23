import {
  BarBackButton,
  CellStack,
  L2,
  NavigationContainer,
  P3,
  icons,
} from "@argent/x-ui"
import { FC, ReactEventHandler, useState } from "react"
import { Button, Center, Flex } from "@chakra-ui/react"
import copy from "copy-to-clipboard"

import { useRouteAccountAddress } from "../../../routes"
import { usePrivateKey } from "../../accountTokens/usePrivateKey"
import { PasswordFormProps } from "../../lock/PasswordForm"
import { useCurrentNetwork } from "../../networks/hooks/useCurrentNetwork"
import { QrCode } from "../../../components/QrCode"
import { PasswordWarningForm } from "../ui/PasswordWarningForm"

const { AlertFillIcon } = icons

export interface ExportPrivateKeyScreenProps
  extends Pick<PasswordFormProps, "verifyPassword"> {
  onBack: ReactEventHandler
  passwordIsValid: boolean
  privateKey?: string
}

export const ExportPrivateKeyScreen: FC<ExportPrivateKeyScreenProps> = ({
  onBack,
  passwordIsValid,
  verifyPassword,
  privateKey,
}) => {
  return (
    <NavigationContainer
      leftButton={<BarBackButton onClick={onBack} />}
      title={"Export private key"}
    >
      {passwordIsValid ? (
        <ExportPrivateKey privateKey={privateKey} />
      ) : (
        <PasswordWarningForm
          verifyPassword={verifyPassword}
          title="Never share your private key!"
          reasons={[
            "It’s the only way to recover your wallet",
            "If someone else has access to your private key they can control your wallet",
          ]}
        />
      )}
    </NavigationContainer>
  )
}

function ExportPrivateKey({
  privateKey: privateKeyProp,
}: {
  privateKey?: string
}) {
  const [privateKeyCopied, setPrivateKeyCopied] = useState(false)
  const accountAddress = useRouteAccountAddress()
  const network = useCurrentNetwork()
  const privateKey = usePrivateKey(accountAddress, network.id) || privateKeyProp
  if (!privateKey) {
    return null
  }
  const onCopy = () => {
    copy(privateKey)
    setPrivateKeyCopied(true)
    setTimeout(() => {
      setPrivateKeyCopied(false)
    }, 3000)
  }
  return (
    <CellStack>
      <Flex
        rounded={"xl"}
        textAlign={"center"}
        color="warn.500"
        px={3}
        py={2.5}
        bg={"warn.900"}
        mb={4}
      >
        <L2>
          WARNING! Never disclose this key. Anyone with your private key can
          steal any assets held in your account
        </L2>
      </Flex>
      <Center overflow={"hidden"} flexDirection={"column"} gap={6} px={6}>
        <QrCode size={208} data={privateKey} data-key={privateKey} />
        <P3
          aria-label="Private key"
          textAlign={"center"}
          fontWeight={"semibold"}
          w={"full"}
        >
          {privateKey}
        </P3>
        <Button
          colorScheme={privateKeyCopied ? "inverted" : undefined}
          size={"sm"}
          leftIcon={<AlertFillIcon color="warn.500" />}
          mx={"auto"}
          onClick={onCopy}
        >
          {privateKeyCopied ? "Copied" : "Copy"}
        </Button>
      </Center>
    </CellStack>
  )
}
