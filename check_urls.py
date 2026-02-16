import requests

urls = [
    "https://storage.googleapis.com/mediapipe-models/llm_inference/gemma_2b_en/gpu/gemma-2b-it-gpu-int4.bin",
    "https://storage.googleapis.com/mediapipe-assets/gemma-2b-it-gpu-int4.bin",
    "https://storage.googleapis.com/mediapipe-tasks/gemma-2b-it-gpu-int4.bin",
    "https://storage.googleapis.com/mediapipe-tasks/genai/llm_inference/gemma-2b-it-gpu-int4.bin",
    "https://storage.googleapis.com/jmstore/gemma-2b-it-gpu-int4.bin",
    "https://storage.googleapis.com/mediapipe-models/llm_inference/gemma_2b_en/gpu/gemma_2b_en.bin"
]

print("Checking URLs...")
for url in urls:
    try:
        response = requests.head(url, timeout=5)
        print(f"{response.status_code}: {url}")
    except Exception as e:
        print(f"Error checking {url}: {e}")
