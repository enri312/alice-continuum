"""Stdlib tests; synthetic pipe data, no models, downloads or microphones."""
import sys
import threading
import unittest
from unittest import mock
from pathlib import Path
from types import SimpleNamespace
import pilot
import bounded_process
from bounded_process import run
from pilot import word_errors, environment, cpp_failure, remote_json, download, require_model


class ProcessContract(unittest.TestCase):
    def test_binary_stdin_is_unchanged_and_stdout_stderr_are_independent(self):
        payload = b"RIFF\x00\xffsynthetic fixture"
        result = run([sys.executable,"-B","-c",
            "import sys;sys.stdout.buffer.write(sys.stdin.buffer.read());sys.stderr.write('diagnostic')"],payload=payload,timeout=5)
        self.assertEqual((result.code,result.failure,result.stdout,result.stderr),(0,None,payload,b"diagnostic"))

    def test_stderr_flood_is_bounded_and_terminates_the_owned_child(self):
        result = run([sys.executable,"-B","-c",
            "import sys,time;sys.stderr.buffer.write(b'x'*200000);sys.stderr.flush();time.sleep(20)"],stderr_limit=1024,timeout=5)
        self.assertEqual(result.failure,"output_limit")
        self.assertEqual(len(result.stderr),1024)
        self.assertLess(result.wall_ms,5000)

    def test_deadline_ends_a_child_without_output(self):
        result = run([sys.executable,"-B","-c","import time;time.sleep(20)"],timeout=.15)
        self.assertEqual(result.failure,"timeout")
        self.assertLess(result.wall_ms,5000)

    def test_cancellation_is_not_reported_as_success(self):
        cancelled = threading.Event()
        cancelled.set()
        result = run([sys.executable,"-B","-c","import time;time.sleep(20)"],cancel=cancelled,timeout=5)
        self.assertEqual(result.failure,"cancelled")

    def test_input_bound_is_enforced_before_launch(self):
        with self.assertRaisesRegex(ValueError,"Input exceeds"):
            run(["not-launched"],payload=b"x"*2_000_001)

    def test_thread_start_failure_reaps_the_owned_child_and_closes_all_pipes(self):
        children = []
        original_popen = bounded_process.subprocess.Popen
        original_start = threading.Thread.start
        attempts = 0
        def capture_child(*args, **kwargs):
            child = original_popen(*args, **kwargs)
            children.append(child)
            return child
        def start(thread):
            nonlocal attempts
            attempts += 1
            if attempts == 2:
                raise RuntimeError("synthetic thread start failure")
            return original_start(thread)
        with mock.patch.object(bounded_process.subprocess,"Popen",side_effect=capture_child), mock.patch.object(threading.Thread,"start",start):
            with self.assertRaisesRegex(RuntimeError,"synthetic thread"):
                run([sys.executable,"-B","-c","import time;time.sleep(20)"],timeout=5)
        self.assertIsNotNone(children[0].poll())
        self.assertTrue(all(pipe.closed for pipe in (children[0].stdin,children[0].stdout,children[0].stderr)))

    def test_environment_does_not_inherit_fixture_secrets_or_proxies(self):
        with mock.patch("pilot.os.environ",{"SystemRoot":"C:/Windows","FISH_API_KEY":"synthetic-secret","OPENAI_API_KEY":"synthetic-secret","HTTPS_PROXY":"synthetic-proxy"}), mock.patch.object(Path,"mkdir"):
            env = environment(Path("D:/private-pilot"))
        self.assertNotIn("FISH_API_KEY",env)
        self.assertNotIn("OPENAI_API_KEY",env)
        self.assertNotIn("HTTPS_PROXY",env)
        self.assertEqual(env["HF_HUB_OFFLINE"],"1")
        for name in ("HOME","USERPROFILE","APPDATA","LOCALAPPDATA","TEMP","HF_HOME"):
            self.assertTrue(env[name].startswith("D:"))

    def test_cpp_exit_zero_with_decode_error_is_not_a_transcription(self):
        self.assertEqual(cpp_failure(0,b"error: failed to read audio file '-'\n"),"decode")
        self.assertEqual(cpp_failure(0,b"error: failed to initialize whisper context\n"),"model")
        self.assertIsNone(cpp_failure(0,b"processing 16000 samples\n"))

    def test_missing_vocabulary_is_rejected_before_starting_an_engine(self):
        with mock.patch.object(Path,"is_file",lambda path: path.name != "vocabulary.txt"):
            with self.assertRaisesRegex(ValueError,"missing vocabulary.txt"):
                require_model(Path("D:/private-pilot/models/faster-whisper-small"))

    def test_metadata_and_asset_downloads_explicitly_receive_private_environment(self):
        private_env = {"TEMP":"D:/private-pilot/temp", "HOME":"D:/private-pilot/home"}
        success = bounded_process.Result(0, 1, b'{"fixture":true}', b"", None)
        target = Path("D:/private-pilot/downloads/fixture.bin")
        with mock.patch.object(pilot,"environment",return_value=private_env), \
                mock.patch.object(pilot,"run",return_value=success) as child, \
                mock.patch.object(Path,"mkdir"), mock.patch.object(Path,"is_file",return_value=False), \
                mock.patch.object(Path,"exists",return_value=False), \
                mock.patch.object(Path,"stat",return_value=mock.Mock(st_size=1)), \
                mock.patch.object(Path,"replace"):
            self.assertEqual(remote_json("https://example.invalid/metadata",Path("D:/private-pilot")),{"fixture":True})
            download("https://example.invalid/fixture",target,16,Path("D:/private-pilot"))
        self.assertEqual(child.call_count,2)
        for invocation in child.call_args_list:
            self.assertIs(invocation.kwargs["env"],private_env)

    def test_worker_metadata_cannot_replace_corpus_identity_or_process_outcome(self):
        fixture = {"cases":[{"id":"pause","file":"pause.wav","expected":"Alice pausa Spotify.",
            "seconds":1.25,"sha256":"synthetic-hash"}]}
        payload = b'{"case":"stdin","failure":"forged","text":"Alice pausa Spotify.","language":"es","compute_type":"int8_float32","import_ms":1,"load_ms":2,"inference_ms":3}'
        args = SimpleNamespace(limit=1,engines="faster",timeout=1,stdout_limit=1024,stderr_limit=1024,pause=0)
        with mock.patch.object(pilot,"synthetic_manifest",return_value=fixture), \
                mock.patch.object(pilot,"require_model"), mock.patch.object(pilot,"available_memory",return_value={}), \
                mock.patch.object(pilot,"environment",return_value={}), mock.patch.object(pilot,"sha",return_value="synthetic-hash"), \
                mock.patch.object(Path,"read_bytes",return_value=b"synthetic-wav"), \
                mock.patch.object(pilot,"run",return_value=bounded_process.Result(0,10,payload,b"",None)), \
                mock.patch.object(pilot,"json_write") as save, mock.patch("builtins.print"), mock.patch.object(pilot.time,"sleep"):
            pilot.compare(args,Path("D:/private-pilot"))
        row = save.call_args.args[1]["results"][0]
        self.assertEqual((row["case"],row["engine"],row["failure"],row["wav_sha256"]),
            ("pause","faster",None,"synthetic-hash"))
        self.assertEqual(row["errors"],0)


class TextMetric(unittest.TestCase):
    def test_accents_case_and_punctuation_do_not_create_word_errors(self):
        self.assertEqual(word_errors("Alice, ¿cómo estás?","ALICE como estas")["errors"],0)

    def test_an_invented_action_counts_as_a_substitution(self):
        self.assertEqual(word_errors("Alice pausa Spotify","Alice reproduce Spotify"),
            {"errors":1,"reference_words":3,"wer":1/3})


if __name__ == "__main__":
    unittest.main()
