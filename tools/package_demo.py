"""Build one self-contained HTML file for a static HTTPS host or event laptop."""
import argparse
import base64
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path, help="New .html file outside the source tree")
output = parser.parse_args().output.resolve()
if root == output or root in output.parents or output.suffix.lower() != ".html":
    parser.error("Choose an .html path outside the source checkout.")
html = (root / "index.html").read_text()
css = (root / "assets/app.css").read_text()
font = base64.b64encode((root / "assets/manrope.ttf").read_bytes()).decode()
css = css.replace("manrope.ttf", "data:font/ttf;base64," + font)
license_text = (root / "assets/OFL.txt").read_text()
html = html.replace('<link rel="stylesheet" href="assets/app.css">', '<style>/*\n' + license_text + '\n*/\n' + css + '</style>')
mark = "data:image/svg+xml;base64," + base64.b64encode((root / "assets/mark.svg").read_bytes()).decode()
for script in ("locale", "model", "message", "voice", "workspace", "network", "app"):
    source = (root / ("src/" + script + ".js")).read_text()
    html = html.replace(f'<script defer src="src/{script}.js"></script>', '<script>\n' + source.replace("</script", "<\\/script") + '\n</script>')
html = html.replace("assets/mark.svg", mark)
output.parent.mkdir(parents=True, exist_ok=True)
with output.open("x", encoding="utf-8") as file:
    file.write(html)
print(output)
