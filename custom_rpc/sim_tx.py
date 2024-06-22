from starknet_py.contract import Contract
from starknet_py.net.full_node_client import FullNodeClient
from starknet_py.net.account.account import Account
from starknet_py.net.models.chains import StarknetChainId
from starknet_py.net.signer.stark_curve_signer import KeyPair
from starknet_py.net.client_models import Call
from starknet_py.utils.typed_data import get_selector_from_name
import asyncio
import json
import pandas as pd

# Used contract deployed by us in te past for testing the tx simulation

client = FullNodeClient(node_url="https://starknet-sepolia.public.blastapi.io/rpc/v0_7")
account = Account(
    client=client,
    address="0x010709063600056ceabc8be55e8b9be6e3dcf789bc84a3e56c01edb177826ee6",
    key_pair=KeyPair(private_key="", public_key="0x4391a3e4169769bd76115601f4386fbecf0bb1b3124e1040309638467db6240"),
    chain=StarknetChainId.SEPOLIA,
) 

async def simulate_transaction(account, contract, calldata, selector):
    contract = await Contract.from_address(provider=account, address=contract)



    # Convert strings to int (felt) representation
    host_felt = int.from_bytes(host.encode(), "big")
    payload_felt = int.from_bytes(payload.encode(), "big")
    method = 0x01

    call = Call(
        to_addr=contract.address,
        selector=selector,
        calldata=calldata
        invoke_tx = await account.sign_invoke_v1(calls=call, max_fee=int(1e16))
        simulation_result = await client.simulate_transactions(transactions=[invoke_tx], block_number="latest")
        print(simulation_result)
        df = pd.DataFrame(simulation_result)
        print(df.head(20))
        print(contract.data.abi)
        print(df)
        df.to_json("out.json")
        return df
    )
