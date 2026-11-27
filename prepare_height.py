"""NASA 고도 JPEG를 브라우저용 1도 격자로 변환한다. Python과 Pillow 필요."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
image = Image.open(ROOT / 'data' / 'heightmap.jpg').convert('L')
width, height = 360, 181
values = []
for row in range(height):
    y = min(image.height - 1, int(row / 180 * image.height))
    samples = [image.getpixel((int(col / width * image.width), y)) for col in range(width)]
    if row in (0, height - 1):
        samples = [round(sum(samples) / width)] * width
    values.extend(samples)
text = '// NASA 고도 이미지에서 추출. 직접 수정하지 말고 prepare_height.py로 재생성.\n'
text += f'const HEIGHT_WIDTH = {width};\nconst HEIGHT_HEIGHT = {height};\n'
text += 'const HEIGHT_VALUES = new Uint8Array(' + json.dumps(values, separators=(',', ':')) + ');\n'
(ROOT / 'data' / 'height-data.js').write_text(text, encoding='utf-8')
print(f'{width} x {height}, {len(values)} samples')
