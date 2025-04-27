import os
from PIL import Image

def resize_image(filename: str, image: Image, size: int, file_name_array: list[str], prev_sizes_array: list[int]):
    if filename.split("_")[-1][:-4] not in [str(prev) for prev in prev_sizes_array]:
        new_filename = filename[:-4] + "_" + str(size) + filename[-4:]
        if new_filename not in file_name_array:
            new_image = image.convert("RGB").resize((size, size))
            new_image.save(new_filename, quality = 95)


if __name__ == "__main__":
    img_directory = "./img/cover_art/"
    file_name_array = [os.path.join(img_directory, file_name) for file_name in os.listdir(img_directory)]
    sizes = [440, 50]
    for counter, f in enumerate(file_name_array):
        img = Image.open(f)
        resize_image(f, img, 440, file_name_array, sizes)
        resize_image(f, img, 50, file_name_array, sizes)
        img.load()
        print(f"({counter + 1}/{len(file_name_array)})", end = "\r")
    print()