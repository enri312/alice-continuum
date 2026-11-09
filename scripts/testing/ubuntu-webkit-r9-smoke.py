"""Check R9 browser APIs without requesting microphone/camera permissions."""
import json
import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import GLib, Gtk, WebKit2

view = WebKit2.WebView()
window = Gtk.Window()
window.add(view)
window.show_all()
result = {}


def evaluated(webview, task, _):
    try:
        result.update(json.loads(webview.evaluate_javascript_finish(task).to_string()))
    except Exception as error:
        result["error"] = str(error)
    Gtk.main_quit()


def loaded(webview, event):
    if event == WebKit2.LoadEvent.FINISHED:
        webview.evaluate_javascript("""JSON.stringify({
          secureContext: window.isSecureContext,
          microphoneApi: typeof navigator.mediaDevices?.getUserMedia === 'function',
          webmOpus: typeof MediaRecorder !== 'undefined' &&
            MediaRecorder.isTypeSupported('audio/webm;codecs=opus'),
          audioContext: typeof AudioContext === 'function',
          audioWorklet: typeof AudioWorkletNode === 'function',
          wasm: typeof WebAssembly === 'object'
        })""", -1, None, None, None, evaluated, None)


def timed_out():
    result["error"] = "WebKit no respondió en 20 segundos"
    Gtk.main_quit()
    return False


view.connect("load-changed", loaded)
GLib.timeout_add_seconds(20, timed_out)
view.load_html("<!doctype html><title>Alice R9 API check</title>", "http://localhost/")
Gtk.main()
window.destroy()
print(json.dumps(result, ensure_ascii=False, indent=2))
if not result or not all(result.get(key) is True for key in (
    "secureContext", "microphoneApi", "webmOpus", "audioContext", "audioWorklet", "wasm"
)):
    raise SystemExit(1)
