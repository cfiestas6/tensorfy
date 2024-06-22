from flask import Flask, request, jsonify
import requests
import json

app = Flask(__name__)

RPC_URL = 'https://cloud.argent-api.com/v1/starknet/sepolia/rpc/v0.7'

def get_abi(contract):
    


@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def mirror_request(path):
    try:
        # Construct URL
        url = f"{RPC_URL}{path}"


        # Log the incoming request
        #print("\n=====================================================================")
        #print("---------------------------------------------------------------------")
        print(f"Received {request.method} request to {request.path}")
        #print('Request headers:', str(dict(request.headers)) + "\n")
        print('Request body:', request.json)
        #print("\n---------------------------------------------------------------------")

        # Prepare data and headers for forwarding
        data = request.get_json(force=True, silent=True)
        headers = {key: value for key, value in request.headers if key.lower() != 'host'}
        
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
            response = requests.request(
                method=request.method,
                url=url,
                headers=headers,
                json=data
            )


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

        # Log response
        print('Response status:', response.status_code)
        print('Response body:', response.json())

        print("\n=====================================================================")

        # Return response
        return jsonify(response.json()), response.status_code

    except requests.exceptions.RequestException as e:
        print("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        print('Error forwarding request to RPC:', e)
        print("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        return jsonify({'error': 'Internal Server Error'}), 500


if __name__ == '__main__':
    app.run(port=3000)
