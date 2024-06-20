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

#Used contract deployed by us in te past for testing the tx simulation

client = FullNodeClient(node_url="https://starknet-sepolia.public.blastapi.io/rpc/v0_7")
account = Account(
    client=client,
    address="0x010709063600056ceabc8be55e8b9be6e3dcf789bc84a3e56c01edb177826ee6",
    key_pair=KeyPair(private_key="", public_key="0x4391a3e4169769bd76115601f4386fbecf0bb1b3124e1040309638467db6240"),
    chain=StarknetChainId.SEPOLIA,
) 

async def simulate_transaction(account):
    contract = await Contract.from_address(provider=account, address="0x079b587c6e75cb38b210fc12e37662c9f518d0025b7e67ac82c080501a105937")

    host = "https://api.ag"[:31]  
    payload = "name=test"[:31]

    # Convert strings to int (felt) representation
    host_felt = int.from_bytes(host.encode(), "big")
    payload_felt = int.from_bytes(payload.encode(), "big")
    method = 0x01

    call = Call(
        to_addr=contract.address,
        selector=get_selector_from_name("create_call"),
        calldata=[host_felt, payload_felt, method]
    )

    # Sign the transaction
    invoke_tx = await account.sign_invoke_v1(calls=call, max_fee=int(1e16))

    # Simulate the transaction
    simulation_result = await client.simulate_transactions(transactions=[invoke_tx], block_number="latest")

    # Print the simulation result
    print(simulation_result)

    df = pd.DataFrame(simulation_result)
    print(df.head(20))
    print(contract.data.abi)
    print(df)
    df.to_json("out.json")
if __name__ == '__main__':
    asyncio.run(simulate_transaction(account))
