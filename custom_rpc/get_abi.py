from starknet_py.contract import Contract
from starknet_py.net.full_node_client import FullNodeClient
from starknet_py.net.account.account import Account
from starknet_py.net.models.chains import StarknetChainId
from starknet_py.net.signer.stark_curve_signer import KeyPair
from starknet_py.net.client_models import Call
from starknet_py.utils.typed_data import get_selector_from_name
import asyncio
import json

client = FullNodeClient(node_url="https://starknet-sepolia.public.blastapi.io/rpc/v0_6")
account = Account(
    client=client,
    address="0x010709063600056ceabc8be55e8b9be6e3dcf789bc84a3e56c01edb177826ee6",
    key_pair=KeyPair(private_key="", public_key="0x4391a3e4169769bd76115601f4386fbecf0bb1b3124e1040309638467db6240"),
    chain=StarknetChainId.SEPOLIA,
)

async def get_abi(address):
    contract = await Contract.from_address(provider=account, address=address)
    c_addres = contract.data.abi
    print(c_addres)

