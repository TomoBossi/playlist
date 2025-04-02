import requests
import json
import os

def download(amazon_music_url, lucida_domain, output_directory, file_name):
    if not os.path.exists(output_directory):
        os.makedirs(output_directory)

    full_file_path = os.path.join(output_directory, f"{file_name}")

    with requests.Session() as s:
        print(f"Starting download request for track {file_name}...")
        # curl 'https://lucida.su/api/load?url=/api/fetch/stream/v2' -X POST -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0' -H 'Accept: */*' -H 'Accept-Language: en-US,en;q=0.5' -H 'Accept-Encoding: gzip, deflate, br, zstd' -H 'Referer: https://lucida.su/?url=https%3A//music.amazon.com/tracks/B0B2NGW2V7%3FmarketplaceId%3DATVPDKIKX0DER%26musicTerritory%3DUS%26ref%3Ddm_sh_QduzWjfHY802GxhF5BKULnoPH&country=auto' -H 'Content-Type: text/plain;charset=UTF-8' -H 'Origin: https://lucida.su' -H 'DNT: 1' -H 'Connection: keep-alive' -H 'Sec-Fetch-Dest: empty' -H 'Sec-Fetch-Mode: no-cors' -H 'Sec-Fetch-Site: same-origin' -H 'Priority: u=0' -H 'Pragma: no-cache' -H 'Cache-Control: no-cache' --data-raw '{"url":"https://music.amazon.com/tracks/B0B2NGW2V7?musicTerritory=US","metadata":false,"compat":false,"private":false,"handoff":true,"account":{"type":"country","id":"auto"},"upload":{"enabled":false,"service":"pixeldrain"},"downscale":"flac-16","token":{"primary":"edoWKvlTChr71LsdhBEdlX2ilno","expiry":1743693278}}'
        r = s.post(f"https://{lucida_domain}/api/load?url=/api/fetch/stream/v2", 
            json={
                "url": amazon_music_url,
                "metadata": False,
                "compat": False,
                "private": False,
                "handoff": True,
                "account": {
                    "type": "country",
                    "id": "auto"
                },
                "upload": {
                    "enabled": False,
                    "service": "pixeldrain"
                },
                "downscale": "flac-16", 
            }
        )

        handoff = r.json()["handoff"]
        server = r.json()["server"]
        
        print("Successfully started download request!")
        print("Converting to FLAC-16@44100Hz...")

        # curl 'https://lucida.su/api/load?url=/api/fetch/request/93daee0f-9d78-4a40-8109-79cc80ff994c&force=hund' -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0' -H 'Accept: */*' -H 'Accept-Language: en-US,en;q=0.5' -H 'Accept-Encoding: gzip, deflate, br, zstd' -H 'Referer: https://lucida.su/?url=https%3A//music.amazon.com/tracks/B0B2NGW2V7%3FmarketplaceId%3DATVPDKIKX0DER%26musicTerritory%3DUS%26ref%3Ddm_sh_QduzWjfHY802GxhF5BKULnoPH&country=auto' -H 'DNT: 1' -H 'Connection: keep-alive' -H 'Sec-Fetch-Dest: empty' -H 'Sec-Fetch-Mode: no-cors' -H 'Sec-Fetch-Site: same-origin' -H 'Priority: u=4' -H 'Pragma: no-cache' -H 'Cache-Control: no-cache'
        while s.get(f"https://{server}.{lucida_domain}/api/fetch/request/{handoff}").json()["status"] != "completed":
            print("Converting to FLAC-16@44100Hz...")

        print("Successfully converted to FLAC!")
        print("Downloading...")

        # curl 'https://hund.lucida.su/api/fetch/request/5a73996e-6fc4-4ff9-bd8e-b0b9cfa58f49/download' -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0' -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' -H 'Accept-Language: en-US,en;q=0.5' -H 'Accept-Encoding: gzip, deflate, br, zstd' -H 'Referer: https://lucida.su/' -H 'DNT: 1' -H 'Connection: keep-alive' -H 'Upgrade-Insecure-Requests: 1' -H 'Sec-Fetch-Dest: document' -H 'Sec-Fetch-Mode: navigate' -H 'Sec-Fetch-Site: same-site' -H 'Priority: u=0, i'
        r = s.get(f"https://{server}.{lucida_domain}/api/fetch/request/{handoff}/download")

        print("Successfully downloaded!")
        print(f"Saving FLAC to {full_file_path}...")

        with open(full_file_path, 'wb') as f:
            f.write(r.content)

        print("Successfully saved!\n")


if __name__ == "__main__":
    lucida_domain = "lucida.su"

    with open("./music/amazon_flac/queue.json", "r") as file:
        queue = json.load(file)

    for track in queue:
        try:
            download(track["amazon_music_url"], lucida_domain, "./music", track["file_name"])
        except Exception as e:
            print(f"Error when attempting to download track {track["file_name"]} ({track["amazon_music_url"]}): {e}")
