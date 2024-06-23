import { AllowArray, shortString, uint256 } from "starknet"
import { ITokenRepository } from "../repository/token"
import { ITokenBalanceRepository } from "../repository/tokenBalance"
import { ITokenPriceRepository } from "../repository/tokenPrice"
import { ITokenService } from "./interface"
import {
  ApiAccountTokenBalances,
  BaseToken,
  BaseTokenSchema,
  Token,
  apiAccountTokenBalancesSchema,
} from "../types/token.model"
import { equalToken } from "../utils"
import { BaseTokenWithBalance } from "../types/tokenBalance.model"
import { BaseWalletAccount } from "../../../wallet.model"
import {
  ApiPriceDataResponseSchema,
  TokenPriceDetails,
  TokenWithBalanceAndPrice,
} from "../types/tokenPrice.model"
import { accountsEqual } from "../../../utils/accountsEqual"
import { groupBy, uniq } from "lodash-es"
import { IObjectStore, SelectorFn } from "../../../storage/__new/interface"
import {
  IHttpService,
  addressSchema,
  bigDecimal,
  ensureArray,
  stripAddressZeroPadding,
  convertTokenAmountToCurrencyValue,
} from "@argent/x-shared"
import { INetworkService } from "../../../network/service/interface"
import { getMulticallForNetwork } from "../../../multicall"
import { getProvider } from "../../../network/provider"
import { Network, defaultNetwork } from "../../../network"
import { TokenError } from "../../../errors/token"
import {
  ApiTokenInfo,
  ApiTokensInfoResponse,
  TokenInfoByNetwork,
  apiTokensInfoResponseSchema,
} from "../types/tokenInfo.model"
import { RefreshInterval } from "../../../config"
import retry from "async-retry"
import { getDefaultNetworkId } from "../../../network/utils"
import { ARGENT_API_BASE_URL } from "../../../api/constants"
import { argentApiNetworkForNetwork } from "../../../api/headers"
import urlJoin from "url-join"
import { ProvisionActivityPayload } from "../../../activity/types"
import vSTRK from "../../../../assets/vSTRK.json"
import { hasDelegationActivity } from "../../../activity/utils/hasDelegationActivity"

/**
 * TokenService class implements ITokenService interface.
 * It provides methods to interact with the token repository, token balance repository and token price repository.
 */
export class TokenService implements ITokenService {
  private readonly TOKENS_INFO_URL: string
  private readonly TOKENS_PRICES_URL: string
  /**
   * @param {INetworkService} networkService - The network service.
   * @param {ITokenRepository} tokenRepo - The token repository.
   * @param {ITokenBalanceRepository} tokenBalanceRepo - The token balance repository.
   * @param {ITokenPriceRepository} tokenPriceRepo - The token price repository.
   * @param {string} TOKENS_INFO_URL - The tokens info url.
   * @param {string} TOKENS_PRICES_URL - The tokens prices url.
   */
  constructor(
    private readonly networkService: INetworkService,
    private readonly tokenRepo: ITokenRepository,
    private readonly tokenBalanceRepo: ITokenBalanceRepository,
    private readonly tokenPriceRepo: ITokenPriceRepository,
    private readonly tokenInfoStore: IObjectStore<TokenInfoByNetwork>,
    private readonly httpService: IHttpService,
    TOKENS_INFO_URL: string | undefined,
    TOKENS_PRICES_URL: string | undefined,
  ) {
    if (!TOKENS_INFO_URL) {
      throw new TokenError({ code: "NO_TOKEN_API_URL" })
    }
    if (!TOKENS_PRICES_URL) {
      throw new TokenError({ code: "NO_TOKEN_PRICE_API_URL" })
    }
    this.TOKENS_INFO_URL = TOKENS_INFO_URL
    this.TOKENS_PRICES_URL = TOKENS_PRICES_URL
  }

  /**
   * Add a token to the token repository.
   * @param {AllowArray<Token>} token - The token to add.
   */
  async addToken(token: AllowArray<Token>): Promise<void> {
    await this.tokenRepo.upsert(token)
  }

  /**
   * Remove a token from the token repository.
   * @param {BaseToken} baseToken - The base token to remove.
   */
  async removeToken(baseToken: BaseToken): Promise<void> {
    const [token] = await this.tokenRepo.get((t) => equalToken(t, baseToken))
    if (!token) {
      return
    }
    await this.tokenRepo.remove(token)
  }

  /**
   * Update tokens in the token repository.
   * @param {AllowArray<Token>} token - The tokens to update.
   */
  async updateTokens(token: AllowArray<Token>): Promise<void> {
    await this.tokenRepo.upsert(token)
  }

  /**
   * Update token balances in the token balance repository.
   * @param {AllowArray<BaseTokenWithBalance>} tokensWithBalance - The tokens with balance to update.
   */
  async updateTokenBalances(
    tokensWithBalance: AllowArray<BaseTokenWithBalance>,
  ): Promise<void> {
    await this.tokenBalanceRepo.upsert(tokensWithBalance)
  }

  /**
   * Update token prices in the token price repository.
   * @param {AllowArray<TokenPriceDetails>} tokenPrices - The token prices to update.
   */
  async updateTokenPrices(
    tokenPrices: AllowArray<TokenPriceDetails>,
  ): Promise<void> {
    await this.tokenPriceRepo.upsert(tokenPrices)
  }

  /**
   * Lazy fetch tokens info from local storage or backend max RefreshInterval.VERY_SLOW
   * @param {string} networkId - The network id.
   * @returns {Promise<ApiTokenInfo[]>} - The fetched tokens or undefined if there was an error or not default network
   */
  async getTokensInfoFromBackendForNetwork(
    networkId: string,
  ): Promise<ApiTokenInfo[] | undefined> {
    /** the backend currently only returns token info for its specific network */
    const isDefaultNetwork = defaultNetwork.id === networkId
    if (!isDefaultNetwork) {
      return
    }
    const tokenInfoByNetwork = await this.tokenInfoStore.get()

    /** if we have data and updatedAt within RefreshInterval.VERY_SLOW, then return that data  */
    if (
      tokenInfoByNetwork &&
      tokenInfoByNetwork[networkId] &&
      tokenInfoByNetwork[networkId].data
    ) {
      if (
        Date.now() - tokenInfoByNetwork[networkId].updatedAt <
        RefreshInterval.SLOW * 1000
      ) {
        return tokenInfoByNetwork[networkId].data
      }
    }

    /** fetch data and check it's valid format */
    const response = await this.httpService.get<ApiTokensInfoResponse>(
      this.TOKENS_INFO_URL,
    )
    const parsedResponse = apiTokensInfoResponseSchema.safeParse(response)
    if (!parsedResponse.success) {
      return
    }

    /** store and update the updatedAt timestamp */
    const data = parsedResponse.data.tokens
    await this.tokenInfoStore.set({
      [networkId]: {
        updatedAt: Date.now(),
        data,
      },
    })
    return data
  }

  /**
   * Fetches token balances from the blockchain.
   * @param {BaseWalletAccount[]} accounts - The accounts for which to fetch token balances.
   * @param {Token[]} tokens - The tokens for which to fetch balances. If not provided, finds all relevant tokens for the accounts
   * @returns {Promise<BaseTokenWithBalance[]>} - The fetched token balances.
   */
  async fetchTokenBalancesFromOnChain(
    accounts: AllowArray<BaseWalletAccount>,
    tokens?: AllowArray<Token>,
  ): Promise<BaseTokenWithBalance[]> {
    const accountsArray = ensureArray(accounts)
    // by default, find all the relevant tokens for all the accounts
    if (!tokens) {
      // create an array of all networks covered by accounts
      const networkIds = uniq(accountsArray.map((account) => account.networkId))
      // create an array of all tokens covered by the networks
      tokens = await this.getTokens((token) =>
        networkIds.includes(token.networkId),
      )
    }
    const tokensArray = ensureArray(tokens)

    const accountsGroupedByNetwork = groupBy(accountsArray, "networkId")
    const tokensGroupedByNetwork = groupBy(tokensArray, "networkId")
    const tokenBalances: BaseTokenWithBalance[] = []

    for (const networkId in accountsGroupedByNetwork) {
      try {
        const tokensOnCurrentNetwork = tokensGroupedByNetwork[networkId] // filter tokens based on networkId
        const network = await this.networkService.getById(networkId)
        if (network.multicallAddress) {
          const balances = await this.fetchTokenBalancesWithMulticall(
            network,
            accountsGroupedByNetwork,
            tokensOnCurrentNetwork,
          )
          tokenBalances.push(...balances)
        } else {
          const balances = await this.fetchTokenBalancesWithoutMulticall(
            network,
            accountsArray,
            tokensOnCurrentNetwork,
          )
          tokenBalances.push(...balances)
        }
      } catch (e) {
        /** Catch error to be resilient to individual network failure */
        console.error(`fetchTokenBalancesFromOnChain error on ${networkId}`, e)
      }
    }
    return tokenBalances
  }

  public async fetchTokenBalancesWithMulticall(
    network: Network,
    accountsGroupedByNetwork: Record<string, BaseWalletAccount[]>,
    tokensOnCurrentNetwork: Token[],
  ): Promise<BaseTokenWithBalance[]> {
    const multicall = getMulticallForNetwork(network)
    const accounts = accountsGroupedByNetwork[network.id]
    const calls = tokensOnCurrentNetwork
      .map((token) =>
        accounts.map((account) =>
          multicall.callContract({
            contractAddress: token.address,
            entrypoint: "balanceOf",
            calldata: [account.address],
          }),
        ),
      )
      .flat()
    const results = await Promise.allSettled(calls)
    const tokenBalances: BaseTokenWithBalance[] = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const token = tokensOnCurrentNetwork[Math.floor(i / accounts.length)]
      const account = accounts[i % accounts.length]
      if (result.status === "fulfilled") {
        const [low, high] = ensureArray(result.value.result)
        const balance = uint256
          .uint256ToBN({ low: low || "0", high: high || "0" })
          .toString()
        tokenBalances.push({
          account,
          ...token,
          balance,
        })
      } else {
        console.error(result.reason)
      }
    }
    return tokenBalances
  }

  async fetchTokenBalancesWithoutMulticall(
    network: Network,
    accountsArray: BaseWalletAccount[],
    tokensOnCurrentNetwork: Token[],
  ): Promise<BaseTokenWithBalance[]> {
    const provider = getProvider(network)
    const tokenBalances: BaseTokenWithBalance[] = []

    for (const account of accountsArray) {
      for (const token of tokensOnCurrentNetwork) {
        const response = await provider.callContract({
          contractAddress: token.address,
          entrypoint: "balanceOf",
          calldata: [account.address],
        })
        const [low, high] = response.result
        const balance = uint256.uint256ToBN({ low, high }).toString()
        tokenBalances.push({
          account,
          ...token,
          balance,
        })
      }
    }
    return tokenBalances
  }

  /**
   * Fetch token prices from the backend.
   * @param {Token[]} tokens - The tokens.
   * @param {string} networkId - The network id.
   * @returns {Promise<TokenPriceDetails[]>} - The fetched token prices.
   */
  async fetchTokenPricesFromBackend(
    tokens: Token[],
    networkId: string,
  ): Promise<TokenPriceDetails[]> {
    const isDefaultNetwork = defaultNetwork.id === networkId
    const tokenPrices = await this.tokenPriceRepo.get(
      (tp) => tp.networkId === networkId,
    )

    if (!isDefaultNetwork) {
      console.warn("Token prices are only available on default network")
      return tokenPrices
    }

    const response = await this.httpService.get(this.TOKENS_PRICES_URL)
    const parsedResponse = ApiPriceDataResponseSchema.safeParse(response)

    if (!parsedResponse.success) {
      throw new TokenError({ code: "TOKEN_PRICE_PARSING_ERROR" })
    }

    const tokenPriceDetails = parsedResponse.data.prices
      .map<TokenPriceDetails | undefined>((tp) => {
        const token = tokens.find(
          (t) => t.pricingId && t.pricingId === tp.pricingId,
        )
        if (!token) {
          return
        }
        return {
          ...tp,
          networkId,
          address: token.address,
        }
      })
      .filter((tp): tp is TokenPriceDetails => tp !== undefined)

    return tokenPriceDetails
  }

  /**
   * Fetch token details from the blockchain.
   * @param {AllowArray<RequestToken>} baseToken - The request token.
   * @returns {Promise<Token[]>} - The fetched tokens.
   */

  async fetchTokenDetails(baseToken: BaseToken): Promise<Token> {
    const [token] = await this.tokenRepo.get((t) => equalToken(t, baseToken))

    // Only return cached token if it's not a custom token
    // Otherwise fetch token details from blockchain
    if (token && !token.custom) {
      return token
    }

    const network = await this.networkService.getById(baseToken.networkId)
    let name: string, symbol: string, decimals: string

    try {
      if (network.multicallAddress) {
        ;[name, symbol, decimals] = await this.fetchTokenDetailsWithMulticall(
          baseToken,
          network,
        )
      } else {
        ;[name, symbol, decimals] =
          await this.fetchTokenDetailsWithoutMulticall(baseToken, network)
      }
    } catch (error) {
      console.error(error)
      throw new TokenError({
        code: "TOKEN_DETAILS_NOT_FOUND",
        message: `Token details not found for token ${baseToken.address}`,
      })
    }

    if (Number.parseInt(decimals) > Number.MAX_SAFE_INTEGER) {
      throw new TokenError({
        code: "UNSAFE_DECIMALS",
        options: { context: { decimals } },
      })
    }

    return {
      address: baseToken.address,
      networkId: baseToken.networkId,
      name: shortString.decodeShortString(name),
      symbol: shortString.decodeShortString(symbol),
      decimals: Number.parseInt(decimals),
      custom: true,
    }
  }

  async fetchTokenDetailsWithMulticall(
    baseToken: BaseToken,
    network: Network,
    tokenEntryPoints = ["name", "symbol", "decimals"],
  ): Promise<string[]> {
    const multicall = getMulticallForNetwork(network)
    const responses = await Promise.all(
      tokenEntryPoints.map((entrypoint) =>
        multicall.callContract({
          contractAddress: baseToken.address,
          entrypoint,
        }),
      ),
    )
    return responses.map((response) => response.result[0])
  }

  async fetchTokenDetailsWithoutMulticall(
    baseToken: BaseToken,
    network: Network,
    tokenEntryPoints = ["name", "symbol", "decimals"],
  ): Promise<string[]> {
    const provider = getProvider(network)
    const responses = await Promise.all(
      tokenEntryPoints.map((entrypoint) =>
        provider.callContract({
          contractAddress: baseToken.address,
          entrypoint,
        }),
      ),
    )
    return responses.map((response) => response.result[0])
  }

  async getToken(baseToken: BaseToken): Promise<Token | undefined> {
    const parsedToken = BaseTokenSchema.parse(baseToken)
    const [token] = await this.tokenRepo.get((t) => equalToken(t, parsedToken))
    return token
  }

  /**
   * Get tokens from the token repository.
   * @param {SelectorFn<Token>} selector - The selector function.
   * @returns {Promise<Token[]>} - The fetched tokens.
   */
  async getTokens(selector?: SelectorFn<Token>): Promise<Token[]> {
    return await this.tokenRepo.get(selector)
  }

  /**
   * Get token balances for an account from the token balance repository.
   * @param {BaseWalletAccount} account - The account.
   * @param {Token[]} tokens - The tokens.
   * @returns {Promise<BaseTokenWithBalance[]>} - The fetched token balances.
   */
  async getTokenBalancesForAccount(
    account: BaseWalletAccount,
    tokens: Token[],
  ): Promise<BaseTokenWithBalance[]> {
    const tokenBalances = await this.tokenBalanceRepo.get(
      (tb) =>
        accountsEqual(tb.account, account) &&
        tokens.some((t) => equalToken(t, tb)),
    )
    return tokenBalances
  }

  /**
   * Get currency value for tokens.
   * @param {BaseTokenWithBalance[]} tokensWithBalances - The tokens with balances.
   * @returns {Promise<TokenWithBalanceAndPrice[]>} - The tokens with balance and price.
   */
  async getCurrencyValueForTokens(
    tokensWithBalances: BaseTokenWithBalance[],
  ): Promise<TokenWithBalanceAndPrice[]> {
    const currencyValues = await this.tokenPriceRepo.get()
    const tokens = await this.getTokens((t) =>
      tokensWithBalances.some((tb) => equalToken(tb, t)),
    )

    const tokenWithPrices = tokensWithBalances.map((tb) => {
      const tokenPrice = currencyValues.find((cv) => equalToken(cv, tb))

      if (!tokenPrice) {
        throw new TokenError({
          code: "TOKEN_PRICE_NOT_FOUND",
          message: `Token price for ${tb.address} not found`,
        })
      }

      const token = tokens.find((t) => equalToken(t, tb))

      if (!token) {
        throw new TokenError({
          code: "TOKEN_NOT_FOUND",
          message: `Token ${tb.address} not found`,
        })
      }

      const usdValue = convertTokenAmountToCurrencyValue({
        amount: tb.balance,
        decimals: token.decimals,
        unitCurrencyValue: tokenPrice.ccyValue,
      })

      if (!usdValue) {
        throw new TokenError({
          code: "UNABLE_TO_CALCULATE_CURRENCY_VALUE",
          message: `Unable to calculate currency value for token ${tb.address}`,
        })
      }

      return {
        ...tb,
        ...token,
        usdValue,
      }
    })

    return tokenWithPrices
  }

  /**
   * Get total currency balance for accounts.
   * @param {BaseWalletAccount[]} accounts - The accounts.
   * @returns {Promise<{ [key: string]: string }>} - The total currency balance for accounts.
   */
  async getTotalCurrencyBalanceForAccounts(
    accounts: BaseWalletAccount[],
  ): Promise<{ [key: string]: string }> {
    const tokenBalances = await this.tokenBalanceRepo.get((tb) =>
      accounts.some((a) => accountsEqual(a, tb.account)),
    )

    const tokensWithBalanceAndPrice =
      await this.getCurrencyValueForTokens(tokenBalances)

    const groupedBalances = groupBy(
      tokensWithBalanceAndPrice,
      ({ account }) => `${account.address}:${account.networkId}`,
    )
    const totalCurrencyBalanceForAccounts: { [key: string]: string } = {}

    for (const account in groupedBalances) {
      const totalBalance = groupedBalances[account].reduce(
        (total, token) =>
          total + bigDecimal.parseCurrency(token.usdValue || "0").value,
        0n,
      )
      totalCurrencyBalanceForAccounts[account] =
        bigDecimal.formatCurrency(totalBalance)
    }

    return totalCurrencyBalanceForAccounts
  }

  async fetchAccountTokenBalancesFromBackend(
    account: BaseWalletAccount,
    opts?: retry.Options,
  ): Promise<BaseTokenWithBalance[]> {
    const defaultNetworkId = getDefaultNetworkId()
    /** This service only works for the default network */
    if (account.networkId !== defaultNetworkId) {
      return []
    }
    const apiBaseUrl = ARGENT_API_BASE_URL
    const argentApiNetwork = argentApiNetworkForNetwork(account.networkId)
    if (!argentApiNetwork) {
      return []
    }

    const url = urlJoin(
      apiBaseUrl,
      "activity",
      "starknet",
      argentApiNetwork,
      "account",
      stripAddressZeroPadding(account.address),
      "balance",
    )

    /** retry until status is "initialised" */
    const accountTokenBalances = await retry(
      async (bail) => {
        let response
        try {
          response = await this.httpService.get<ApiAccountTokenBalances>(url)
        } catch (e) {
          /** bail without retry if there is any fetching error */
          bail(new Error("Error fetching"))
          return []
        }
        const parsedRespose = apiAccountTokenBalancesSchema.safeParse(response)
        if (!parsedRespose.success) {
          bail(new Error("Error parsing response"))
          return []
        }
        if (parsedRespose.data.status !== "initialised") {
          /** causes a retry */
          throw new Error("Not initialised yet")
        }
        return parsedRespose.data.balances
      },
      {
        /** seems to take 5-10 sec for initialised state */
        retries: 5,
        minTimeout: 5000,
        ...opts,
      },
    )

    const baseTokenWithBalances: BaseTokenWithBalance[] =
      accountTokenBalances.map((accountTokenBalance) => {
        return {
          address: accountTokenBalance.tokenAddress,
          balance: accountTokenBalance.tokenBalance,
          networkId: account.networkId,
          account,
        }
      })

    return baseTokenWithBalances
  }

  async handleProvisionTokens(payload: ProvisionActivityPayload) {
    const hasDelegation = hasDelegationActivity(payload.activity)

    if (hasDelegation) {
      void this.addToken({
        ...vSTRK,
        networkId: payload.account.networkId,
        address: addressSchema.parse(vSTRK.address),
      })
    }
  }
}
