from flask import Flask, request, jsonify
import requests
import json
from get_abi import get_abi
import asyncio
from query_llm import llm_call, pre_promt


app = Flask(__name__)

RPC_URL = 'https://cloud.argent-api.com/v1/starknet/sepolia/rpc/v0.7'

def hex_to_dec(hex_str):
    return int(hex_str, 16)

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def mirror_request(path):
    try:
        # Construct URL
        url = f"{RPC_URL}{path}"

        # Log the incoming request
        print(f"Received {request.method} request to {request.path}")
        print('Request body:', request.json)
        
        # Prepare data and headers for forwarding
        data = request.get_json(force=True, silent=True)
        headers = {key: value for key, value in request.headers if key.lower() != 'host'}
        llm_query = []

        if isinstance(data, list):
            
            responses = []
            
            for item in data:
                if 'method' in item and item['method'] == "starknet_estimateFee":
                    print("Handling starknet_estimateFee for an item in list")
                response = requests.request(
                    method=request.method,
                    url=url,
                    headers=headers,
                    json=item
                )
                responses.append(response.json())

            return jsonify(responses), 200  # Returns a list of responses

        else:
            if data.get("method") == "starknet_estimateFee":
                print("Handling starknet_estimateFee")
                sender_address = data['params']['request'][0]['sender_address']
                abi = None
                if sender_address:
                    abi = asyncio.run(get_abi(sender_address))
                llm_query.append(abi)

                call_d = request.json
                call_d = str(call_d['params']['request'][0]['calldata'])
                print(call_d)
            response = requests.request(
                method=request.method,
                url=url,
                headers=headers,
                json=data
            )
            response_json = response.json()
            response_decimal = None  # Initialize response_decimal

            if 'result' in response_json and isinstance(response_json['result'], list):
                result = response_json['result'][0]
                if isinstance(result, dict):
                    response_decimal = {
                        'gas_consumed': hex_to_dec(result['gas_consumed']),
                        'gas_price': hex_to_dec(result['gas_price']),
                        'data_gas_consumed': hex_to_dec(result['data_gas_consumed']),
                        'data_gas_price': hex_to_dec(result['data_gas_price']),
                        'overall_fee': hex_to_dec(result['overall_fee']),
                        'unit': result['unit']
                    }
                    print('Response in decimal:', response_decimal)
                    llm_query.append(call_d)
                    llm_query.append(response_decimal)
                    llm_query.append(pre_promt)

            str_query = str(llm_query)
            call_sim = llm_call(str_query)
            print(call_sim)
            print('Response status:', response.status_code)
            print('Response body:', response.json())
            return jsonify(response.json()), response.status_code

        # Forward request
        response = requests.request(
            method=request.method,
            url=url,
            headers=headers,
            json=data
        )

        ## Log response
        #print('Response status:', response.status_code)
        #print('Response body:', response.json())
#
        #print("\n=====================================================================")

        # Return response
        return jsonify(response.json()), response.status_code

    except requests.exceptions.RequestException as e:
        print("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        print('Error forwarding request to RPC:', e)
        print("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        return jsonify({'error': 'Internal Server Error'}), 500
    except Exception as e:
        print("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        print('Error processing request:', e)
        print("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        return jsonify({'error': 'Internal Server Error'}), 500


if __name__ == '__main__':
    app.run(port=3000)
