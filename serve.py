"""Startup Panic local dev server.

Serves the game with correct ES-module MIME types, and ALSO mounts the sibling
three.js Editor on the SAME origin so the editor and the game share a port (no
CORS). Five URL prefixes are mapped onto the editor checkout so its importmap
(../build/, ../examples/jsm/, ../files/, ../src/) keeps resolving.

It also exposes:
  POST /api/save-level   -> writes the editor scene JSON to level.json on disk,
                            which js/levelLoader.js polls and live-loads.
  GET  /level.json       -> returns {} when the file does not exist yet, so the
                            game's poller stays quiet until the first save.

The editor's "Save Level" / "Import Level" menu items call the adapter module at
/tools/level-bridge.js (served from this game folder).
"""
import http.server
import json
import mimetypes
import os
import socketserver
import threading


PORT = int(os.environ.get("PORT", "8741"))

# Root of this game (served at "/"). Always serve here even if the shell cwd is
# elsewhere (e.g. launched from the wrong terminal tab).
GAME_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(GAME_DIR)

# three.js Editor checkout. These URL prefixes are mapped onto its tree so the
# editor app lives at /editor/ and its importmap (../build, ../examples, ...)
# resolves on this same origin.
EDITOR_DIR = os.path.normpath(
    os.environ.get(
        "EDITOR_DIR", r"D:\_Proj_src\Sandscape\Games\three.js_Editor"
    )
)
EDITOR_PREFIXES = ("/editor/", "/build/", "/examples/", "/files/", "/src/")

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/wasm", ".wasm")

_extensions = dict(http.server.SimpleHTTPRequestHandler.extensions_map)
_extensions.update(
    {
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".css": "text/css",
        ".wasm": "application/wasm",
    }
)


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = _extensions

    def translate_path(self, path):
        # Route the editor prefixes onto the editor checkout; everything else is
        # served from the game folder by the default handler.
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean == "/editor":
            clean = "/editor/"
        for prefix in EDITOR_PREFIXES:
            if clean.startswith(prefix):
                rel = clean[1:]  # strip leading "/"
                candidate = os.path.normpath(os.path.join(EDITOR_DIR, *rel.split("/")))
                # Block traversal outside the editor tree.
                if candidate == EDITOR_DIR or candidate.startswith(EDITOR_DIR + os.sep):
                    return candidate
                break
        return super().translate_path(path)

    def do_GET(self):
        # Redirect bare "/editor" -> "/editor/" so the editor's relative paths
        # resolve correctly.
        if self.path.split("?", 1)[0] == "/editor":
            self.send_response(301)
            self.send_header("Location", "/editor/")
            self.end_headers()
            return
        # The game polls level.json. Before the first save it does not exist;
        # return an empty scene (200) instead of 404 so the console stays clean.
        path = self.path.split("?", 1)[0]
        if path == "/level.json" and not os.path.exists(os.path.join(GAME_DIR, "level.json")):
            body = b"{}"
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/save-level":
            self.send_error(405, "Method Not Allowed")
            return

        length_hdr = self.headers.get("Content-Length")
        if not length_hdr:
            self.send_error(400, "Missing Content-Length")
            return
        try:
            n = int(length_hdr)
        except ValueError:
            self.send_error(400, "Bad Content-Length")
            return

        body = self.rfile.read(n)
        try:
            text = body.decode("utf-8")
        except UnicodeDecodeError:
            self.send_error(400, "Body must be UTF-8")
            return

        try:
            json.loads(text)
        except json.JSONDecodeError as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps({"ok": False, "error": "Invalid JSON", "detail": str(e)}).encode("utf-8")
            )
            return

        out_path = os.path.join(GAME_DIR, "level.json")
        tmp_path = out_path + ".tmp"
        # Serialize concurrent saves so the tmp-file + os.replace handoff is atomic.
        with self.server.save_lock:
            try:
                with open(tmp_path, "w", encoding="utf-8", newline="\n") as f:
                    f.write(text)
                os.replace(tmp_path, out_path)
            except OSError as e:
                try:
                    if os.path.isfile(tmp_path):
                        os.remove(tmp_path)
                except OSError:
                    pass
                self.send_error(500, f"Write failed: {e}")
                return

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')


class _Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    # The editor fires ~100 parallel module fetches at boot; the default backlog
    # of 5 makes the kernel RST the overflow and the browser sees random
    # ERR_CONNECTION_REFUSED on editor files.
    request_queue_size = 256
    daemon_threads = True
    save_lock = threading.Lock()


if __name__ == "__main__":
    server = _Server(("127.0.0.1", PORT), Handler)
    print(f"Startup Panic local server: http://127.0.0.1:{PORT}/")
    print(f"Three.js Editor:            http://127.0.0.1:{PORT}/editor/")
    print("Press Ctrl+C to stop.")
    server.serve_forever()
