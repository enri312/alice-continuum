import unittest
import subprocess
import sys
import os
from types import SimpleNamespace
from unittest.mock import patch
from linux_media_bridge import validate, target_url, media_reference, matches_reference, command_parts, ParentGuard, youtube_playlist_request, playlist_loop_state, Bridge

PLAYLIST = 'PL0123456789abcdefghijklmnopqrstuv'
URL = 'https://www.youtube.com/playlist?list=' + PLAYLIST


class Node:
    def __init__(self, role, name='', parent=None, **attrs):
        self.role, self.name, self.parent, self.attrs = role, name, parent, attrs
        self.children = []
        self.pressed = False
        if parent is not None:
            parent.children.append(self)
    def get_role(self): return self.role
    def clear_cache(self): pass
    def set_cache_mask(self, _): pass
    def get_name(self): return self.name() if callable(self.name) else self.name
    def get_attributes(self): return self.attrs
    def get_state_set(self): return SimpleNamespace(contains=lambda _: self.pressed and self.role in ('toggle', 'check', 'switch'))
    def get_parent(self): return self.parent
    def get_child_count(self): return len(self.children)
    def get_child_at_index(self, i): return self.children[i]


class PlayerFixture(Bridge):
    """Stateful accessible player, including YouTube's three repeat modes."""
    def __init__(self, loop=0, private=False, panel=True, native=False):
        self.A = SimpleNamespace(Role=SimpleNamespace(DOCUMENT_WEB='doc', PUSH_BUTTON='button', TOGGLE_BUTTON='toggle', CHECK_BOX='check', SWITCH='switch', LINK='link'), StateType=SimpleNamespace(PRESSED='pressed', CHECKED='checked'), Cache=SimpleNamespace(DEFAULT=127, NAME=4, STATES=16))
        self.owner = SimpleNamespace(require_alive=lambda: None)
        self.mode, self.playing, self.actions, self.opened = loop, False, [], []
        self.reset_on_start = native
        self.uri = 'https://www.youtube.com/watch?v=abc123_-XYZ&list=' + PLAYLIST
        self.doc = Node('doc', 'Test song - YouTube')
        self.panel = Node('section', parent=self.doc, **{'class': 'ytd-playlist-panel-renderer' if panel else ''})
        self.loop = Node('toggle', lambda: 'Loop video' if self.mode == 2 else 'Loop playlist', self.panel)
        self.loop.pressed = bool(loop)
        self.shuffle = Node('toggle', 'Shuffle playlist', self.panel)
        self.shuffle.pressed = True
        self.autoplay = Node('switch', 'Autoplay', self.doc, **{'class': 'ytp-autonav-toggle-button'})
        self.autoplay.pressed = True
        self.transport = Node('button', lambda: 'Pause (k)' if self.playing else 'Play (k)', self.doc)
        if native:
            self.loop.role = 'button'
            self.loop.name = lambda: ('Repetir playlist', 'Repetir video indefinidamente', 'Desactivar la repetición indefinida')[self.mode]
            self.transport.name = lambda: 'Pausa combinación de teclas k' if self.playing else 'Volver a reproducir combinación de teclas k'
            self.transport.attrs['keyshortcuts'] = 'k'
            Node('section', parent=self.doc, **{'class': 'ytp-autonav-toggle-button'})
        if private:
            self.uri = URL
            self.doc.children = [Node('static', 'La playlist no existe.')]
    def documents(self, service): return [(self.doc, self.uri)]
    def name(self, node): return node.get_name()
    def state_contains(self, node, state): return node.get_state_set().contains(state)
    def pump(self): pass
    def activate_youtube_tab(self): return True
    def chrome(self, url): self.opened.append(url)
    def click(self, node):
        self.actions.append(node)
        if node is self.loop:
            self.mode = (self.mode + 1) % 3
            node.pressed = bool(self.mode)
        elif node is self.transport:
            if not self.playing and self.reset_on_start:
                self.mode = 0
                self.loop.pressed = False
            self.playing = not self.playing
        else:
            node.pressed = not node.pressed
    def wait_for(self, callback, seconds=12):
        for _ in range(15):
            value = callback()
            if value: return value
        raise RuntimeError('Player state was not confirmed')


class LinuxMediaContractTests(unittest.TestCase):
    def test_configured_playlist_is_the_only_allowed_selection(self):
        for query in (None, 'mi playlist', 'mi música', URL, 'https://www.youtube.com/watch?v=abc123_-XYZ&list=' + PLAYLIST):
            self.assertEqual(youtube_playlist_request(query, None, URL), ('list:' + PLAYLIST, URL))
        for query in ('another song', 'playlist other', 'https://www.youtube.com/watch?v=abc123_-XYZ', 'https://www.youtube.com/playlist?list=PLother0123456789', URL + '&list=PLother0123456789'):
            with self.assertRaises(ValueError):
                youtube_playlist_request(query, None, URL)
        with self.assertRaises(ValueError): youtube_playlist_request(None, 'video:abc123_-XYZ', URL)
        with self.assertRaises(ValueError): youtube_playlist_request(None, None, '')

    def test_repeat_one_must_not_be_reported_as_repeat_playlist(self):
        self.assertEqual(playlist_loop_state('Loop playlist', False), 'off')
        self.assertEqual(playlist_loop_state('Loop playlist', True), 'all')
        self.assertEqual(playlist_loop_state('Repetir video', True), 'one')
        self.assertEqual(playlist_loop_state('Loop playlist', None), 'off')
        self.assertEqual(playlist_loop_state('Repetir video', None), 'all')
        self.assertEqual(playlist_loop_state('Repetir video indefinidamente', None), 'all')
        self.assertEqual(playlist_loop_state('Desactivar repetición', None), 'one')
        self.assertEqual(playlist_loop_state('Desactivar la repetición indefinida', None), 'one')
        self.assertIsNone(playlist_loop_state('Unknown repeat mode', None))

    def test_play_sets_full_repeat_order_and_disables_autoplay_idempotently(self):
        for initial, native in ((n, native) for n in (0, 1, 2) for native in (False, True)):
            bridge = PlayerFixture(loop=initial, native=native)
            with patch.dict(os.environ, ALICE_YOUTUBE_PLAYLIST_URL=URL):
                receipt = bridge.youtube('play', 'mi playlist', None)
                self.assertTrue(bridge.playing)
                self.assertEqual(bridge.mode, 1)
                self.assertFalse(bridge.shuffle.pressed)
                self.assertFalse(bridge.autoplay.pressed)
                self.assertEqual(receipt['target'], 'list:' + PLAYLIST)
                count = len(bridge.actions)
                bridge.youtube('play', 'mi playlist', receipt['target'])
                self.assertEqual(len(bridge.actions), count)
                bridge.youtube('pause', None, receipt['target'])
                self.assertFalse(bridge.playing)
                bridge.youtube('resume', None, receipt['target'])
                self.assertTrue(bridge.playing)

    def test_only_an_unambiguous_owned_youtube_tab_can_be_activated(self):
        class Tab:
            def __init__(self, selected=False): self.selected = selected
            def get_role(self): return 'tab'
            def get_name(self): return 'My playlist - YouTube'
            def clear_cache(self): pass
            def get_state_set(self): return SimpleNamespace(contains=lambda _: self.selected)
        bridge = Bridge.__new__(Bridge)
        bridge.A = SimpleNamespace(Role=SimpleNamespace(PAGE_TAB='tab'), StateType=SimpleNamespace(SELECTED='selected'))
        bridge.app = lambda _: [None]
        bridge.wait_for = lambda callback: callback()
        clicked = []
        def click(tab):
            tab.selected = True
            clicked.append(tab)
        bridge.click = click
        bridge.state_contains = lambda node, _: node.selected
        tab = Tab()
        bridge.walk = lambda *args, **kwargs: [tab]
        self.assertTrue(bridge.activate_youtube_tab())
        self.assertEqual(clicked, [tab])
        self.assertTrue(bridge.activate_youtube_tab())
        self.assertEqual(clicked, [tab])
        bridge.walk = lambda *args, **kwargs: [Tab(), Tab()]
        with self.assertRaises(RuntimeError): bridge.activate_youtube_tab()
        self.assertEqual(clicked, [tab])

    def test_playlist_url_alone_never_confirms_playback_or_repeat(self):
        for fixture in (PlayerFixture(panel=False), PlayerFixture(private=True)):
            with patch.dict(os.environ, ALICE_YOUTUBE_PLAYLIST_URL=URL), self.assertRaises(RuntimeError):
                fixture.youtube('play', 'mi playlist', None)
            self.assertFalse(fixture.actions)
            self.assertTrue(all(url == URL for url in fixture.opened))

    def test_other_music_is_rejected_before_any_browser_action(self):
        bridge = PlayerFixture()
        with patch.dict(os.environ, ALICE_YOUTUBE_PLAYLIST_URL=URL), self.assertRaises(ValueError):
            bridge.youtube('play', 'unrelated song', None)
        self.assertFalse(bridge.opened)
        self.assertFalse(bridge.actions)

    def test_chromium_process_titles_preserve_profile_identity(self):
        parts=[b'chrome',b'--user-data-dir=/tmp/alice-profile',b'--force-renderer-accessibility']
        self.assertEqual(command_parts(b'\0'.join(parts)),parts)
        self.assertEqual(command_parts(b' '.join(parts)),parts)
        self.assertEqual(command_parts(b'chrome "--user-data-dir=/tmp/profile with spaces"')[1],b'--user-data-dir=/tmp/profile with spaces')

    @unittest.skipUnless(hasattr(os,'pidfd_open'),'Linux pidfd required')
    def test_owner_exit_prevents_further_desktop_actions(self):
        child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(10)'])
        guard=ParentGuard(child.pid)
        try:
            guard.require_alive()
            child.terminate();child.wait(timeout=3)
            with self.assertRaises(RuntimeError):guard.require_alive()
        finally:
            if child.poll() is None:child.kill();child.wait()
            guard.close()

    def test_radio_links_match_the_requested_video_without_changing_playlist_identity(self):
        url='https://www.youtube.com/watch?v=abc123_-XYZ&list=PL0123456789abcdefghijklmnopqrstuv'
        self.assertTrue(matches_reference(url,'video:abc123_-XYZ'))
        self.assertTrue(matches_reference(url,'list:PL0123456789abcdefghijklmnopqrstuv'))
        self.assertFalse(matches_reference(url,'video:01234567890'))

    def test_only_fixed_services_and_operations_are_accepted(self):
        for request in [
            {'service': 'filesystem', 'operation': 'open'},
            {'service': 'spotify', 'operation': 'shell'},
            {'service': 'youtube', 'operation': 'play', 'command': 'anything'},
            {'service': 'youtube', 'operation': 'play', 'query': 'a\nb'},
            {'service': 'spotify', 'operation': 'play', 'query': 'a' * 181},
            {'service': 'youtube', 'operation': 'pause', 'previous': 'https://other.test'},
        ]:
            with self.assertRaises(ValueError):
                validate(request)

    def test_spotify_ids_are_canonical_and_cannot_be_commands(self):
        self.assertEqual(media_reference('https://open.spotify.com/track/0123456789ABCDEFGHIJKL', 'spotify'), 'spotify:track:0123456789ABCDEFGHIJKL')
        self.assertIsNone(media_reference('https://open.spotify.com/track/0123456789ABCDEFGHIJKL', 'spotify', True))
        self.assertIsNone(media_reference('https://open.spotify.com/playlist/../../anything', 'spotify'))

    def test_youtube_playlist_keeps_its_identity_across_tracks(self):
        playlist = 'PL0123456789abcdefghijklmnopqrstuv'
        for video in ('01234567890', 'abc123_-XYZ'):
            self.assertEqual(media_reference(f'https://www.youtube.com/watch?v={video}&list={playlist}', 'youtube'), 'list:' + playlist)
        self.assertEqual(media_reference('https://www.youtube.com/watch?v=abc123_-XYZ', 'youtube'), 'video:abc123_-XYZ')
        self.assertIsNone(media_reference('https://www.youtube.com/watch?v=abc123_-XYZ', 'youtube', True))

    def test_deceptive_hosts_credentials_ports_and_paths_are_rejected(self):
        for url in ('https://youtube.com.evil.test/watch?v=abc123_-XYZ',
                    'https://user:secret@www.youtube.com/watch?v=abc123_-XYZ',
                    'https://www.youtube.com:1234/watch?v=abc123_-XYZ',
                    'https://www.youtube.com:invalid/watch?v=abc123_-XYZ',
                    'http://www.youtube.com/watch?v=abc123_-XYZ',
                    'file:///tmp/song', 'https://www.youtube.com/redirect?q=anything'):
            self.assertFalse(target_url(url, 'youtube'), url)

    def test_missing_or_malformed_video_ids_never_become_navigation(self):
        for url in ('https://www.youtube.com/watch?v=short',
                    'https://www.youtube.com/playlist?list=../outside',
                    'https://www.youtube.com/results?search_query=music',
                    'https://www.youtube.com/watch?v=abc123_-XYZ%0Acommand'):
            self.assertIsNone(media_reference(url, 'youtube'), url)


if __name__ == '__main__':
    unittest.main()
