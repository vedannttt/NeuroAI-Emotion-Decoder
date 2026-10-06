from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent / "dist"


class SpaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        path = ROOT / self.translate_path(self.path).replace(str(ROOT), "").lstrip("\\/")
        if not path.exists() and "." not in Path(self.path).name:
            self.path = "/index.html"
        return super().send_head()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 3001), SpaHandler)
    print("Serving frontend at http://127.0.0.1:3001/")
    server.serve_forever()
