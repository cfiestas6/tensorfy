import json
import requests

response = requests.get("https://starknet-sepolia.infura.io/v3/6e774f59dce9469b8679aa3c37f4c06f")

result = response.json()
