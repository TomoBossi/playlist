import subprocess
import json
import os

def download(yt_uid, output_directory, file_name, start=None, end=None):
    if not os.path.exists(output_directory):
        os.makedirs(output_directory)

    full_file_path = os.path.join(output_directory, f"{file_name}")
    flac_file_path = f"{".".join(full_file_path.split(".")[:-1])}.flac"

    if not (os.path.exists(full_file_path) or os.path.exists(flac_file_path)):
        ytdlp_cmd = ["yt-dlp", "-f", "bestaudio/best", "--extract-audio", "--audio-format", "mp3", "--audio-quality", "128", "--output", full_file_path]
        if start or end:
            start = start if start else "00:00:00.0"
            ytdlp_cmd.extend(["--postprocessor-args", f"-ss {start} -to {end}" if end else f"-ss {start}"])
        ytdlp_cmd.append(yt_uid)

        subprocess.run(ytdlp_cmd, check=True)


if __name__ == "__main__":
    with open("./music/download/queue.json", "r") as file:
        queue = json.load(file)

    for track in queue:
        try:
            download(track["yt_uid"], "./music", track["file_name"], track.get("start", None), track.get("end", None))
        except Exception as e:
            print(f"Error when attempting to download track {track["file_name"]} ({track["yt_uid"]}): {e}")