import os
import httpx
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("RAPID_API_KEY")
api_host = os.environ.get("RAPID_API_HOST", "exercisedb.p.rapidapi.com")

print(f"API Key present: {bool(api_key)}")
print(f"API Host: {api_host}")

url = f"https://{api_host}/exercises"
headers = {
    "x-rapidapi-key": api_key,
    "x-rapidapi-host": api_host
}

try:
    print("Sending request to RapidAPI...")
    response = httpx.get(url, headers=headers, params={"limit": 5})
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Success! Found {len(data)} exercises.")
        print("Sample:", data[0].get("name"))
    else:
        print("Error response:", response.text)
except Exception as e:
    print(f"Exception: {e}")
