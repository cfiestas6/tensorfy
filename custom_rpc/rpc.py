from flask import Flask, request, jsonify
import requests
import json

app = Flask(__name__)

RPC_URL = 'https://cloud.argent-api.com/v1/starknet/sepolia/rpc/v0.7'


@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def mirror_request(path):
    try:
        # Construct URL
        url = f"{RPC_URL}{path}"


        # Log the incoming request
        print("\n=====================================================================")
        print("---------------------------------------------------------------------")
        print(f"Received {request.method} request to {request.path}")
        print('Request headers:', str(dict(request.headers)) + "\n")
        print('Request body:', request.json)
        print("\n---------------------------------------------------------------------")

        # Prepare data and headers for forwarding
        data = request.get_json(force=True, silent=True)
        headers = {key: value for key, value in request.headers if key.lower() != 'host'}

        if data and isinstance(data, list):
            for item in data:
                if item.get('method') == 'starknet_addInvokeTransaction':
                    transaction_data = item.get('params', {}).get('invoke_transaction', {})

                    payload = {
                            "jsonrpc": "2.0",
                            "method": "starknet_simulateTransaction",
                            "params": {
                                "transactions": {
                                    "to": transaction_data.get('sender_address'),
                                    "data": transaction_data.get('calldata'),
                                    "nonce": transaction_data.get('nonce'),
                                    "signature": transaction_data.get('signature'),
                                }
                            },
                            "block_id": "pending",
                            "simulation_flags": ["SKIP_EXECUTE"]
                    }

                    print("\n\nPayload for simulation: ", payload + "\n\n")

                    simulate_response = requests.request(
                            method='POST',
                            url=url,
                            headers={"Content-Type: application/json"},
                            json=jsonify(payload)
                    )

                    print("= = = = = = = = = = = = = = = ")
                    print("SIMULATE RESPONSE:")
                    print(simulate_response.status_code)
                    print(simulate_response.json())
                    print("= = = = = = = = = = = = = = = ")
                    return jsonify(simulate_response.json()), simulate_response.status_code

        # Forward request
        response = requests.request(
            method=request.method,
            url=url,
            headers=headers,
            json=data
        )

        # Log response
        print('Response status:', response.status_code)
        print('Response body:', response.json())

        print("\n=====================================================================")

        # Return response
        return jsonify(response.json()), response.status_code

    except requests.exceptions.RequestException as e:
        print("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        print('Error forwarding request to Infura:', e)
        print("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        return jsonify({'error': 'Internal Server Error'}), 500


if __name__ == '__main__':
    app.run(port=3000)
