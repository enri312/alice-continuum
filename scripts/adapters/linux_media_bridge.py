"""Narrow Linux music bridge: Spotify/YouTube only, MPRIS + visible AT-SPI UI.

No shell commands, browser debugging ports, tokens, keyboard injection or generic
automation endpoint. The Rust caller owns cancellation and the process timeout.
"""
import json
import re
import shutil
import subprocess
import sys
import time
import unicodedata
import os
import shlex
import select
from pathlib import Path
from urllib.parse import urlencode, urlparse, parse_qs


def folded(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text.lower()) if not unicodedata.combining(c))


def target_url(value, service):
    try:
        url = urlparse(value)
        valid = url.scheme == 'https' and not url.username and not url.password and url.port in (None, 443)
    except ValueError:
        return False
    if not valid:
        return False
    if service == 'spotify':
        return url.hostname in ('open.spotify.com', 'xpui.app.spotify.com')
    return url.hostname in ('youtube.com', 'www.youtube.com') and url.path in ('/', '/results', '/watch', '/playlist')


def media_reference(url, service, playlist=False):
    if not target_url(url, service):
        return None
    parsed = urlparse(url)
    if service == 'spotify':
        match = re.fullmatch(r'/(track|playlist|album)/([A-Za-z0-9]{22})', parsed.path)
        if match and (not playlist or match[1] == 'playlist'):
            return 'spotify:' + match[1] + ':' + match[2]
    else:
        values = parse_qs(parsed.query)
        lists = values.get('list', [])
        if len(lists) > 1:
            return None
        if lists and re.fullmatch(r'[A-Za-z0-9_-]{10,80}', lists[0]):
            return 'list:' + lists[0]
        videos = values.get('v', [])
        if not playlist and parsed.path == '/watch' and len(videos) == 1 and re.fullmatch(r'[A-Za-z0-9_-]{11}', videos[0]):
            return 'video:' + videos[0]
    return None


def youtube_video_reference(url):
    if not target_url(url, 'youtube') or urlparse(url).path != '/watch':
        return None
    videos = parse_qs(urlparse(url).query).get('v', [])
    video = videos[0] if len(videos) == 1 else ''
    return 'video:' + video if re.fullmatch(r'[A-Za-z0-9_-]{11}', video) else None


def matches_reference(url, reference):
    return (youtube_video_reference(url) if reference.startswith('video:') else media_reference(url, 'youtube')) == reference


def youtube_playlist_request(query, previous, configured):
    target = media_reference(configured, 'youtube', True)
    if not target:
        raise ValueError('Primero configura el enlace de tu playlist de YouTube en ALICE_YOUTUBE_PLAYLIST_URL.')
    aliases = ('mi playlist', 'mi lista', 'mi musica', 'musica', 'la musica', 'mi lista de reproduccion')
    if query and folded(query).strip() not in aliases and media_reference(query, 'youtube', True) != target:
        raise ValueError('YouTube está limitado a tu playlist configurada. No reproduciré otra lista ni buscaré música fuera de ella.')
    if previous and previous != target:
        raise ValueError('La reproducción anterior no pertenece a tu playlist configurada. Pide «reproduce mi playlist en YouTube».')
    return target, 'https://www.youtube.com/playlist?' + urlencode({'list': target[5:]})


def playlist_loop_state(label, pressed):
    label = folded(label)
    if not any(word in label for word in ('bucle', 'repet', 'loop')):
        return None
    if pressed is False:
        return 'off'
    if pressed is not True:
        # Modern YouTube labels the NEXT action on its three-state button.
        # "Repeat playlist" was observed with the player stopped at list end.
        label = label.strip()
        if label in ('repetir playlist', 'loop playlist'):
            return 'off'
        if label.startswith(('repetir video', 'loop video')):
            return 'all'
        if label.startswith(('desactivar repeticion', 'desactivar la repeticion', 'desactivar reproduccion', 'desactivar la reproduccion', 'no repetir', 'turn off loop', 'do not loop')):
            return 'one'
        return None
    if re.search(r'\b(video|song|cancion|uno|once)\b', label):
        return 'one'
    return 'all' if any(word in label for word in ('playlist', 'lista')) else None


def validate(request):
    if not isinstance(request, dict) or set(request) - {'service', 'operation', 'query', 'previous'}:
        raise ValueError('Solicitud musical inválida.')
    if request.get('service') not in ('spotify', 'youtube') or request.get('operation') not in ('open', 'play', 'pause', 'resume'):
        raise ValueError('Servicio u operación no admitidos.')
    query = request.get('query')
    if query is not None and (not isinstance(query, str) or not 1 <= len(query) <= 180 or any(ord(c) < 32 for c in query)):
        raise ValueError('Título inválido.')
    previous = request.get('previous')
    if previous is not None and (not isinstance(previous, str) or not re.fullmatch(r'(?:video:[A-Za-z0-9_-]{11}|list:[A-Za-z0-9_-]{10,80})', previous)):
        raise ValueError('Referencia de reproducción inválida.')
    return request


def browser_profile():
    return Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share')) / 'alice-continuum/youtube-profile'


def command_parts(raw):
    args = [part for part in raw.split(b'\0') if part]
    return [part.encode() for part in shlex.split(args[0].decode())] if len(args) == 1 else args


class ParentGuard:
    def __init__(self, pid=None):
        self.fd = os.pidfd_open(os.getppid() if pid is None else pid)
        self.poller = select.poll()
        self.poller.register(self.fd, select.POLLIN)

    def require_alive(self):
        if self.poller.poll(0):
            raise RuntimeError('La aplicación que solicitó la acción se cerró. No se enviarán más controles.')

    def close(self):
        os.close(self.fd)


def browser_pids():
    flag = ('--user-data-dir=' + str(browser_profile())).encode()
    result = set()
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit():
            continue
        try:
            if proc.stat().st_uid != os.getuid():
                continue
            args = command_parts((proc / 'cmdline').read_bytes())
            if flag in args and not any(arg.startswith(b'--type=') for arg in args) and (proc / 'exe').resolve().name in ('chrome', 'chromium'):
                result.add(int(proc.name))
        except (OSError, ValueError):
            continue
    return result


class Bridge:
    def __init__(self):
        self.owner = ParentGuard()
        import gi
        gi.require_version('Atspi', '2.0')
        from gi.repository import Atspi, Gio, GLib
        self.A, self.G, self.V = Atspi, Gio, GLib
        self.bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        address = self.bus.call_sync('org.a11y.Bus', '/org/a11y/bus', 'org.a11y.Bus', 'GetAddress', None, None, Gio.DBusCallFlags.NONE, 3000, None).unpack()[0]
        self.a11y_bus = Gio.DBusConnection.new_for_address_sync(address, Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT | Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION, None, None)
        Atspi.init()
        Atspi.set_timeout(1000, 1000)
        self.context = GLib.MainContext.default()

    def pump(self):
        while self.context.pending():
            self.context.iteration(False)

    def name(self, node):
        # Direct native properties bypass libatspi's stale Chrome name cache.
        return self.a11y_bus.call_sync(node.app.bus_name, node.path, 'org.freedesktop.DBus.Properties', 'Get', self.V.Variant('(ss)', ('org.a11y.atspi.Accessible', 'Name')), None, self.G.DBusCallFlags.NONE, 1000, None).unpack()[0]

    def state_contains(self, node, state):
        words = self.a11y_bus.call_sync(node.app.bus_name, node.path, 'org.a11y.atspi.Accessible', 'GetState', None, None, self.G.DBusCallFlags.NONE, 1000, None).unpack()[0]
        value = int(state)
        return bool(words[value // 32] & (1 << (value % 32)))

    def dbus(self, name, interface, method, signature=None, args=()):
        return self.bus.call_sync(name, '/org/mpris/MediaPlayer2', interface, method,
            self.V.Variant(signature, args) if signature else None, None, self.G.DBusCallFlags.NONE, 3000, None).unpack()

    def names(self):
        return self.bus.call_sync('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'ListNames', None, None, self.G.DBusCallFlags.NONE, 3000, None).unpack()[0]

    def props(self, name):
        return self.dbus(name, 'org.freedesktop.DBus.Properties', 'GetAll', '(s)', ('org.mpris.MediaPlayer2.Player',))[0]

    def player_call(self, name, method, uri=None):
        self.owner.require_alive()
        return self.dbus(name, 'org.mpris.MediaPlayer2.Player', method, '(s)' if uri else None, (uri,) if uri else ())

    def app(self, service):
        desktop = self.A.get_desktop(0)
        spotify_pid = None
        if service == 'spotify':
            spotify_pid = self.bus.call_sync('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'GetConnectionUnixProcessID', self.V.Variant('(s)', ('org.mpris.MediaPlayer2.spotify',)), None, self.G.DBusCallFlags.NONE, 3000, None).unpack()[0]
        youtube_pids = browser_pids() if service == 'youtube' else set()
        apps = []
        for i in range(desktop.get_child_count()):
            node = desktop.get_child_at_index(i)
            if (spotify_pid and node.get_process_id() == spotify_pid) or (service == 'youtube' and node.get_process_id() in youtube_pids):
                if service == 'youtube':
                    # A navigation replaces web accessibles. Never dispatch an
                    # action through Chrome's cached, previous child tree.
                    node.set_cache_mask(self.A.Cache.DEFAULT & ~self.A.Cache.CHILDREN)
                apps.append(node)
        return apps

    def walk(self, root, limit=6000, stop_at_documents=False):
        queue = [root]
        count = 0
        while queue and count < limit:
            node = queue.pop(0)
            count += 1
            try:
                yield node
                if stop_at_documents and node.get_role() == self.A.Role.DOCUMENT_WEB:
                    continue
                queue.extend(node.get_child_at_index(i) for i in range(min(node.get_child_count(), 200)))
            except Exception:
                continue

    def documents(self, service):
        self.pump()
        for app in self.app(service):
            # Do not read unrelated Chrome documents or their contents.
            for node in self.walk(app, 2500, stop_at_documents=True):
                try:
                    if node.get_role() != self.A.Role.DOCUMENT_WEB:
                        continue
                    attrs = node.get_document_attributes()
                    uri = attrs.get('URI') or attrs.get('DocURL') or attrs.get('URL') or ''
                    if target_url(uri, service):
                        yield node, uri
                except Exception:
                    continue

    def click(self, node):
        self.owner.require_alive()
        for i in range(node.get_n_actions()):
            if node.get_action_name(i).lower() in ('click', 'press', 'activate', 'jump', 'dodefault'):
                if node.do_action(i):
                    self.pump()
                    return
        raise RuntimeError('El reproductor no permitió activar ese control.')

    def wait_for(self, callback, seconds=12):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            self.owner.require_alive()
            self.pump()
            try:
                value = callback()
            except self.V.Error:
                # Chromium replaces accessibility objects while navigating.
                # Retry discovery, never a previously dispatched action.
                value = None
            if value:
                return value
            time.sleep(.25)
        raise RuntimeError('No pude confirmar el estado del reproductor. Revisa su ventana o su sesión iniciada.')

    def open_spotify(self, uri=None):
        self.owner.require_alive()
        name = 'org.mpris.MediaPlayer2.spotify'
        if name not in self.names():
            path = shutil.which('spotify')
            if not path:
                raise RuntimeError('Spotify no está instalado en Ubuntu.')
            # A separate transient app unit prevents closing Spotify with Alice.
            subprocess.run(['systemd-run', '--user', '--collect', '--unit=alice-spotify-player', path, '--force-renderer-accessibility', *([uri] if uri else [])], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            self.wait_for(lambda: name in self.names())
        if uri:
            self.player_call(name, 'OpenUri', uri)
        return name

    def playback(self, name, wanted):
        def state():
            props = self.props(name)
            meta = props.get('Metadata', {})
            return {'title': meta.get('xesam:title', ''), 'url': meta.get('xesam:url', '')} if props.get('PlaybackStatus') == wanted else None
        return self.wait_for(state)

    def spotify(self, operation, query):
        name = self.open_spotify()
        if operation == 'open':
            return {'text': 'Spotify está abierto.', 'target': None}
        if operation in ('pause', 'resume'):
            self.player_call(name, 'Pause' if operation == 'pause' else 'Play')
            state = self.playback(name, 'Paused' if operation == 'pause' else 'Playing')
            return {'text': 'Spotify quedó en pausa.' if operation == 'pause' else 'Spotify volvió a reproducir.', 'target': None}
        if query is not None:
            raise RuntimeError('En Spotify está preparada la colección Tus me gusta. Puedes pedir esa colección, pausar o continuar.')
        self.open_spotify('spotify:collection:tracks')

        def collection():
            for document, _ in self.documents('spotify'):
                nodes = list(self.walk(document))
                names = ('reproducir tus me gusta', 'play liked songs')
                if not any(node.get_role() in (self.A.Role.HEADING, self.A.Role.TABLE) and folded(node.get_name() or '') in ('tus me gusta', 'liked songs') for node in nodes):
                    continue
                for node in nodes:
                    if node.get_role() in (self.A.Role.PUSH_BUTTON, self.A.Role.TOGGLE_BUTTON) and folded(node.get_name() or '') in names:
                        return node, 'Tus me gusta'
                    if node.get_role() in (self.A.Role.PUSH_BUTTON, self.A.Role.TOGGLE_BUTTON) and folded(node.get_name() or '') in ('pausar tus me gusta', 'pausa tus me gusta', 'pause liked songs') and self.props(name).get('PlaybackStatus') == 'Playing':
                        return None, 'Tus me gusta'
            return None
        control, label = self.wait_for(collection)
        if control is not None:
            self.click(control)
        state = self.playback(name, 'Playing')
        if state['url'].startswith('spotify:ad:') or folded(state['title']).strip('. ') in ('advertisement', 'anuncio', 'escucha musica sin anuncios'):
            return {'text': 'Solicité Tus me gusta. Spotify está reproduciendo un anuncio en este momento.', 'target': None}
        return {'text': 'Spotify está reproduciendo ' + label + (': ' + state['title'] if state['title'] else '') + '.', 'target': None}

    def chrome(self, url):
        self.owner.require_alive()
        if not target_url(url, 'youtube'):
            raise ValueError('Sólo se permite abrir YouTube en Chrome.')
        chrome = shutil.which('google-chrome') or shutil.which('google-chrome-stable')
        if not chrome:
            raise RuntimeError('Google Chrome no está instalado.')
        profile = browser_profile()
        profile.mkdir(parents=True, exist_ok=True, mode=0o700)
        args = [chrome, '--force-renderer-accessibility', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + str(profile), url]
        if browser_pids():
            subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            subprocess.run(['systemd-run', '--user', '--collect', '--unit=alice-youtube-player', *args[:1], '--new-window', *args[1:]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    def pressed(self, node):
        if self.state_contains(node, self.A.StateType.PRESSED) or self.state_contains(node, self.A.StateType.CHECKED):
            return True
        if node.get_role() in (self.A.Role.TOGGLE_BUTTON, self.A.Role.CHECK_BOX, self.A.Role.SWITCH):
            return False
        attrs = node.get_attributes()
        for attr in ('pressed', 'checked'):
            if attrs.get(attr) in ('true', 'false'):
                return attrs[attr] == 'true'
        return None

    def playlist_panel(self, node):
        for _ in range(15):
            if node is None or node.get_role() == self.A.Role.DOCUMENT_WEB:
                return False
            if 'ytd-playlist-panel-renderer' in node.get_attributes().get('class', '').split():
                return True
            node = node.get_parent()
        return False

    def activate_youtube_tab(self):
        tabs = [node for app in self.app('youtube') for node in self.walk(app, 2500, stop_at_documents=True) if node.get_role() == self.A.Role.PAGE_TAB and 'youtube' in folded(node.get_name() or '')]
        for tab in tabs:
            if self.state_contains(tab, self.A.StateType.SELECTED):
                return True
        if len(tabs) > 1:
            raise RuntimeError('Hay varias pestañas de YouTube en el Chrome de Alice. Selecciona la de tu playlist para controlarla.')
        if tabs:
            self.click(tabs[0])
            def selected():
                return self.state_contains(tabs[0], self.A.StateType.SELECTED)
            self.wait_for(selected)
            return True
        return False

    def transports(self, nodes, document):
        playing, paused = [], []
        for node in nodes:
            if node.get_role() != self.A.Role.PUSH_BUTTON:
                continue
            attrs = node.get_attributes()
            label = folded(self.name(node) or '')
            if attrs.get('keyshortcuts') != 'k' and '(k)' not in label and 'ytp-play-button' not in attrs.get('class', '').split():
                continue
            if label.startswith(('pausa', 'pause')):
                playing.append((node, document))
            elif label.startswith(('reproducir', 'play', 'volver a reproducir', 'replay')):
                paused.append((node, document))
        return playing, paused

    def youtube(self, operation, query, previous):
        target, landing = youtube_playlist_request(query, previous, os.environ.get('ALICE_YOUTUBE_PLAYLIST_URL', ''))
        if operation == 'open':
            self.chrome(landing)
            return {'text': 'Abrí tu playlist de YouTube en Chrome.', 'target': target}
        self.activate_youtube_tab()
        if operation == 'play':
            documents = [(doc, uri) for doc, uri in self.documents('youtube') if matches_reference(uri, target)]
            verified_panel = any(urlparse(uri).path == '/watch' and any(self.playlist_panel(node) for node in self.walk(doc)) for doc, uri in documents)
            if not verified_panel and not any(urlparse(uri).path == '/playlist' for _, uri in documents):
                self.chrome(landing)
        wanted = 'Paused' if operation == 'pause' else 'Playing'
        invoked = set()
        stable = 0
        ad_showing = False
        def playing():
            nonlocal stable, ad_showing
            playing_controls, paused_controls = [], []
            for document, uri in self.documents('youtube'):
                if not matches_reference(uri, target):
                    continue
                nodes = list(self.walk(document))
                ad_showing = any({'html5-video-player', 'ad-showing'} <= set(node.get_attributes().get('class', '').split()) for node in nodes)
                if any(folded(node.get_name() or '').strip() in ('la playlist no existe.', 'la playlist no existe', 'this playlist does not exist.', 'this playlist does not exist', 'this playlist is private.', 'esta playlist es privada.') for node in nodes):
                    raise RuntimeError('Tu playlist es privada o no está disponible. Inicia sesión en la ventana de YouTube de Alice con la cuenta que tiene acceso; no seleccionaré otra lista.')
                if urlparse(uri).path == '/playlist':
                    if wanted == 'Paused':
                        continue
                    for node in nodes:
                        label = folded(node.get_name() or '').strip()
                        if label in ('reproducir todo', 'play all') and node.get_role() in (self.A.Role.LINK, self.A.Role.PUSH_BUTTON):
                            if node.get_role() == self.A.Role.LINK:
                                link = node.get_hyperlink()
                                if not link or not matches_reference(link.get_uri(0), target):
                                    continue
                            key = ('start', hash(node))
                            if key not in invoked:
                                self.click(node)
                                invoked.add(key)
                            break
                    continue
                if wanted == 'Playing' and not any(self.playlist_panel(node) for node in nodes):
                    continue
                active, inactive = self.transports(nodes, document)
                # Starting an ended video can reset YouTube's playlist state.
                # Start playback first, then configure repeat on that player.
                if wanted == 'Playing' and not active:
                    for control, _ in inactive:
                        key = ('play', hash(control))
                        if key not in invoked:
                            self.click(control)
                            invoked.add(key)
                            break
                    continue
                if wanted == 'Playing':
                    loops = [(node, playlist_loop_state(self.name(node) or '', self.pressed(node))) for node in nodes if node.get_role() in (self.A.Role.PUSH_BUTTON, self.A.Role.TOGGLE_BUTTON) and self.playlist_panel(node) and any(word in folded(self.name(node) or '') for word in ('bucle', 'repet', 'loop'))]
                    if len(loops) != 1 or loops[0][1] is None:
                        continue
                    loop, state = loops[0]
                    if state != 'all':
                        key = ('loop', youtube_video_reference(uri), hash(loop), state)
                        if key not in invoked:
                            self.click(loop)
                            invoked.add(key)
                        continue
                    # The playlist must run in order. Do not alter Spotify Free.
                    unsettled = False
                    for node in nodes:
                        if node.get_role() not in (self.A.Role.PUSH_BUTTON, self.A.Role.TOGGLE_BUTTON) or not self.playlist_panel(node):
                            continue
                        label = folded(self.name(node) or '')
                        if any(word in label for word in ('aleator', 'shuffle')):
                            enabled = self.pressed(node)
                            if enabled is None:
                                unsettled = True
                            elif enabled:
                                key = ('shuffle', hash(node))
                                if key not in invoked:
                                    self.click(node)
                                    invoked.add(key)
                                unsettled = True
                    if unsettled:
                        continue
                    for node in nodes:
                        actionable = node.get_role() in (self.A.Role.PUSH_BUTTON, self.A.Role.TOGGLE_BUTTON, self.A.Role.CHECK_BOX, self.A.Role.SWITCH)
                        if not actionable:
                            continue
                        attrs = node.get_attributes()
                        label = folded(self.name(node) or '')
                        classes = attrs.get('class', '').split()
                        autoplay = 'ytp-autonav-toggle-button' in classes or ('ytp-button' in classes and any(word in label for word in ('reproduccion automatica', 'autoplay')))
                        if actionable and autoplay:
                            enabled = self.pressed(node)
                            if enabled is None:
                                if re.search(r'\b(desactivad[oa]|off)\b', label): enabled = False
                                elif re.search(r'\b(activad[oa]|on)\b', label): enabled = True
                            if enabled is None:
                                unsettled = True
                            elif enabled:
                                key = ('autoplay', hash(node))
                                if key not in invoked:
                                    self.click(node)
                                    invoked.add(key)
                                unsettled = True
                    if unsettled:
                        continue
                playing_controls.extend(active)
                paused_controls.extend(inactive)
            ready = playing_controls if wanted == 'Playing' else (paused_controls if not playing_controls else [])
            if ready:
                stable += 1
                if stable >= 2:
                    return True
                return None
            stable = 0
            controls = playing_controls if wanted == 'Paused' else paused_controls
            for control, _ in controls:
                key = hash(control)
                if key not in invoked:
                    self.click(control)
                    invoked.add(key)
                    break
            return None
        self.wait_for(playing, 40)
        text = 'Tu playlist de YouTube quedó en pausa.' if wanted == 'Paused' else 'YouTube está reproduciendo tu playlist en orden y con repetición completa.'
        if wanted == 'Playing' and ad_showing:
            text = 'Tu playlist está preparada con repetición completa. YouTube está mostrando un anuncio en este momento.'
        return {'text': text, 'target': target}


def main():
    try:
        request = validate(json.loads(sys.stdin.read(4097)))
        bridge = Bridge()
        result = bridge.spotify(request['operation'], request.get('query')) if request['service'] == 'spotify' else bridge.youtube(request['operation'], request.get('query'), request.get('previous'))
        print(json.dumps({'ok': True, **result}, ensure_ascii=False))
    except Exception as error:
        # Provider exceptions can include system paths; never print credentials.
        message = str(error) if type(error) in (RuntimeError, ValueError) else 'No se pudo controlar el reproductor. Revisa la sesión y la accesibilidad de la aplicación.'
        print(json.dumps({'ok': False, 'text': message}, ensure_ascii=False))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
