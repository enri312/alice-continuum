"""Optional live desktop check: play last playlist video, verify first resumes.

Requires the owner's configured playlist and signed-in Alice Chrome profile.
Changes playback selection; never run in CI or alongside other media actions.
For small playlists with all rows accessible; waits at most 150 seconds at end.
Output includes private video IDs: keep its log under local/artifacts/.
"""
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'adapters'))
from linux_media_bridge import Bridge, youtube_playlist_request, matches_reference, playlist_loop_state, folded


def main():
    bridge = Bridge()
    target, _ = youtube_playlist_request(None, None, os.environ.get('ALICE_YOUTUBE_PLAYLIST_URL', ''))
    bridge.youtube('play', 'mi playlist', None)

    def current():
        for document, uri in bridge.documents('youtube'):
            if matches_reference(uri, target):
                return uri, list(bridge.walk(document))
        return None

    uri, nodes = bridge.wait_for(current)
    choices = []
    for node in nodes:
        if node.get_role() != bridge.A.Role.LINK or not bridge.playlist_panel(node):
            continue
        link = node.get_hyperlink()
        url = link.get_uri(0) if link else ''
        if not matches_reference(url, target):
            continue
        values = parse_qs(urlparse(url).query)
        if values.get('v') and values.get('index'):
            choices.append((int(values['index'][0]), values['v'][0], node))
    first = min(choices, key=lambda item: item[0])
    last = max(choices, key=lambda item: item[0])
    if first[1] == last[1]:
        raise RuntimeError('This acceptance check requires at least two available videos.')
    print(json.dumps({'stage': 'playlist_members', 'firstVideo': first[1], 'lastVideo': last[1]}), flush=True)
    bridge.click(last[2])

    def last_ready():
        state = current()
        if state is None:
            return None
        uri, nodes = state
        if parse_qs(urlparse(uri).query).get('v') != [last[1]]:
            return None
        if any('ad-showing' in node.get_attributes().get('class', '').split() for node in nodes):
            return None
        for node in nodes:
            if node.get_role() == bridge.A.Role.SLIDER and any(word in folded(node.get_name() or '') for word in ('busqueda', 'seek')):
                duration = node.get_maximum_value()
                if duration > 10:
                    return node, duration
        return None

    slider, duration = bridge.wait_for(last_ready, 35)
    # A manual playlist-row selection may reset repeat. Configure the final
    # player after navigation, exactly as an owner play/resume request does.
    bridge.youtube('play', 'mi playlist', None)
    slider, duration = bridge.wait_for(last_ready, 35)
    print(json.dumps({'stage': 'last_video_playing', 'position': slider.get_current_value(), 'duration': duration}), flush=True)

    def returned():
        state = current()
        if state is None:
            return None
        uri, nodes = state
        if parse_qs(urlparse(uri).query).get('v') != [first[1]]:
            return None
        modes = [playlist_loop_state(bridge.name(node) or '', bridge.pressed(node)) for node in nodes
                 if node.get_role() in (bridge.A.Role.PUSH_BUTTON, bridge.A.Role.TOGGLE_BUTTON)
                 and bridge.playlist_panel(node)
                 and any(word in folded(bridge.name(node) or '') for word in ('repet', 'loop', 'bucle'))]
        playing = any(node.get_role() == bridge.A.Role.PUSH_BUTTON
                      and node.get_attributes().get('keyshortcuts') == 'k'
                      and folded(bridge.name(node) or '').startswith(('pausa', 'pause')) for node in nodes)
        return {'stage': 'returned_to_first', 'samePlaylist': True, 'playing': True, 'repeatModes': modes} if playing and modes == ['all'] else None

    print(json.dumps(bridge.wait_for(returned, min(duration + 20, 150))), flush=True)


if __name__ == '__main__':
    main()
