# scripts/test_raw_audd.py
import sys
import requests
import os

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_raw_audd.py \"Título\" \"Artista (opcional)\"")
        sys.exit(1)

    title = sys.argv[1]
    artist = sys.argv[2] if len(sys.argv) > 2 else ""
    api_key = os.environ.get("AUDD_API_KEY")
    if not api_key:
        print("AUDD_API_KEY no está definida en el entorno.")
        sys.exit(1)

    q = f"{title} {artist}".strip()
    url = "https://api.audd.io/findLyrics/"
    try:
        r = requests.get(url, params={"q": q, "api_token": api_key}, timeout=10)
        print("STATUS CODE:", r.status_code)
        try:
            print("RAW JSON RESPONSE:")
            print(r.json())
        except Exception as e:
            print("Failed to parse JSON:", e)
            print(r.text)
    except Exception as e:
        print("Request error:", e)

if __name__ == '__main__':
    main()