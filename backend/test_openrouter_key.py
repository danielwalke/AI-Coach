import os
import requests
from dotenv import load_dotenv

# Force reload of .env file
load_dotenv(override=True)

api_key = os.environ.get("OPENROUTER_API_KEY")
print(f"API Key present: {bool(api_key)}")
if api_key:
    print(f"API Key start: {api_key[:5]}..." if len(api_key) > 5 else "Key too short")

    # Simple test request
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "nvidia/nemotron-nano-9b-v2:free",
        "messages": [{"role": "user", "content": "Hi"}],
    }
    try:
        resp = requests.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers, timeout=10)
        print(f"Status Code: {resp.status_code}")
        if resp.status_code == 200:
            print("Response:", resp.json()['choices'][0]['message']['content'])
        else:
            print("Error:", resp.text)
    except Exception as e:
        print(f"Request failed: {e}")
else:
    print("WARNING: OPENROUTER_API_KEY not found in environment.")
