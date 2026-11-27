from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent

image = Image.open(ROOT / "data" / "heightmap.jpg").convert("L")

width = 360
height = 181
values = []

for row in range(height):
    y = min(image.height - 1, int(row / 180 * image.height))
    samples = []

    for col in range(width):
        x = int(col / width * image.width)
        samples.append(image.getpixel((x, y)))

    if row == 0 or row == height - 1:
        average = round(sum(samples) / width)
        samples = [average] * width

    values.extend(samples)

text = f"const HEIGHT_WIDTH = {width};\n"
text += f"const HEIGHT_HEIGHT = {height};\n"
text += "const HEIGHT_VALUES = new Uint8Array("
text += json.dumps(values, separators=(",", ":"))
text += ");\n"

output = ROOT / "data" / "height-data.js"
output.write_text(text, encoding="utf-8")

print(f"{width} x {height}, {len(values)} samples")