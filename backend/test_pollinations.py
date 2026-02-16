import requests
import json

def test_pollinations():
    url = "https://text.pollinations.ai/"
    headers = {"Content-Type": "application/json"}
    data = {
        "messages": [
            {"role": "user", "content": "Write a short poem about coding."}
        ],
        "model": "openai", # or other models they support
        "stream": True # verify if they support stream param or if it always streams
    }
    
    # Pollinations usually works with GET for simple text or POST.
    # Documentation says: POST / with json body including messages
    
    try:
        response = requests.post(url, json=data, stream=True)
        print(f"Status: {response.status_code}")
        for chunk in response.iter_content(chunk_size=None):
            if chunk:
                print(chunk.decode('utf-8'), end='', flush=True)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_pollinations()
