import requests

urls = [
    "https://storage.googleapis.com/mediapipe-models/llm_inference/gemma_2b_en/cpu/gemma_2b_en.bin",
    "https://storage.googleapis.com/mediapipe-models/llm_inference/gemma_2b_en/float16/gemma_2b_en.bin",
    "https://storage.googleapis.com/mediapipe-models/gemma/gemma-2b-it-gpu-int4.bin"
]

print("Checking URLs...")
for url in urls:
    try:
        response = requests.head(url, timeout=5)
        print(f"{response.status_code}: {url}")
    except Exception as e:
        print(f"Error checking {url}: {e}")
