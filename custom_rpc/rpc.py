from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

INFURA_URL = 'https://starknet-sepolia.public.blastapi.io/'


@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def mirror_request(path):
    try:
        # Construct URL
        url = f"{INFURA_URL}{path}"


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

        if data.method == 'starknet_addInvokeTransaction':
            # CUSTOM LOGIC
            pass

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

# Simulate tx sending data to another RPC and send output of the transaction to LLM pipe
def simulate_transaction():
    pass


if __name__ == '__main__':
    app.run(port=3000)
