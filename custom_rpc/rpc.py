from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

INFURA_URL = 'https://starknet-sepolia.public.blastapi.io/'  # Replace with the actual Infura RPC URL

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def mirror_request(path):
    try:
        # Construct the Infura URL
        url = f"{INFURA_URL}{path}"

        # Log the incoming request
        print("\n=====================================================================")
        print("---------------------------------------------------------------------")
        print(f"Received {request.method} request to {request.path}")
        print('Request headers:', dict(request.headers))
        print('Request body:', request.json)
        print("\n---------------------------------------------------------------------")

        # Prepare the data and headers for forwarding
        data = request.get_json(force=True, silent=True)  # Ensures the JSON payload is parsed
        headers = {key: value for key, value in request.headers if key.lower() != 'host'}
        # Forward the request to Infura
        response = requests.request(
            method=request.method,
            url=url,
            headers=headers,
            json=data
        )

        # Log the response from Infura
        print('Response status:', response.status_code)
        print('Response body:', response.json())

        print("\n=====================================================================")
        # Return the response from Infura
        return jsonify(response.json()), response.status_code

    except requests.exceptions.RequestException as e:
        print("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        print('Error forwarding request to Infura:', e)
        print("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        return jsonify({'error': 'Internal Server Error'}), 500

if __name__ == '__main__':
    app.run(port=3000)
