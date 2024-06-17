import { FlexProps, Skeleton } from "@chakra-ui/react"
import { FC } from "react"

import { SeedWordBadge } from "./SeedWordBadge"

interface LoadingSeedWordBadgeProps extends FlexProps {
  animationDelay?: number
}

export const LoadingSeedWordBadge: FC<LoadingSeedWordBadgeProps> = ({
  animationDelay = 0,
  ...rest
}) => {
  return (
    <SeedWordBadge
      as={Skeleton}
      sx={{ animationDelay: `${animationDelay}ms` }}
      {...rest}
    >
      &nbsp;
    </SeedWordBadge>
  )
}
