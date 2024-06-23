import { expect, test } from "vitest"

import {
  getStarkPair,
  pathHash,
  grindKey,
} from "../src/background/keys/keyDerivation"
import { STANDARD_DERIVATION_PATH } from "../src/shared/wallet.service"

test("generate Stark Pair", () => {
  const secret =
    "0xe6904d63affe7a13cd30345b000c9b1ffc087832332d7303cf237ffda8a177d0"

  const starkPair5 = getStarkPair(5, secret, STANDARD_DERIVATION_PATH)
  expect(starkPair5.pubKey).toBe(
    "0x05c7c65bfda7a85af0681c85c9c440f0aa6825feef6f9c96e55fb2ce08c8d4bc",
  )

  const starkPair7 = getStarkPair(7, secret, STANDARD_DERIVATION_PATH)
  expect(starkPair7.pubKey).toBe(
    "0x0605d5a0ece3b316f0d72221228acb7f01dcb34db74e0c02790db156741f5a86",
  )
})

test("grindKey", () => {
  const privateKey =
    "0x86F3E7293141F20A8BAFF320E8EE4ACCB9D4A4BF2B4D295E8CEE784DB46E0519"
  const res = grindKey(privateKey)
  expect(res).toBe(
    "0x5c8c8683596c732541a59e03007b2d30dbbbb873556fe65b5fb63c16688f941",
  )
})

test("pathHash", () => {
  expect(pathHash("starknet")).toBe(1195502025)
  expect(pathHash("starkex")).toBe(579218131)
  expect(pathHash("argentx")).toBe(1148870696)
})
