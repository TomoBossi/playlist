import requests
import json
import os

def download(amazon_music_url, lucida_domain, output_directory, file_name):
    if not os.path.exists(output_directory):
        os.makedirs(output_directory)

    full_file_path = os.path.join(output_directory, f"{file_name}")

    if not os.path.exists(full_file_path):
        with requests.Session() as s:
            print(f"Starting download request for track {file_name}...")

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

            while s.get(f"https://{server}.{lucida_domain}/api/fetch/request/{handoff}").json()["status"] != "completed":
                print("Converting to FLAC-16@44100Hz...")

            print("Successfully converted to FLAC!")
            print("Downloading...")

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
