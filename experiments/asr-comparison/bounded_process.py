"""Owned subprocesses only: bounded pipes, deadline, and cooperative cancellation."""
from dataclasses import dataclass
import os
import subprocess
import threading
import time


@dataclass(frozen=True)
class Result:
    code: int
    wall_ms: float
    stdout: bytes
    stderr: bytes
    failure: str | None


def run(command, *, payload=b"", cwd=None, env=None, timeout=90.0,
        stdout_limit=65536, stderr_limit=65536, cancel=None):
    if timeout <= 0 or stdout_limit < 1 or stderr_limit < 1:
        raise ValueError("Positive timeout and pipe limits are required")
    if len(payload) > 2_000_000:
        raise ValueError("Input exceeds the pilot's 2 MB limit")
    started = time.perf_counter()
    child = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, cwd=cwd, env=env if env is not None else {
            key:os.environ[key] for key in ("SystemRoot","WINDIR","PATH","COMSPEC","PATHEXT",
                "PROCESSOR_ARCHITECTURE","NUMBER_OF_PROCESSORS","SystemDrive") if key in os.environ},
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    overflow = threading.Event()
    pipe_error = threading.Event()
    streams = [bytearray(), bytearray()]

    def read(pipe, output, limit):
        try:
            while block := pipe.read(4096):
                room = limit - len(output)
                output.extend(block[:max(0, room)])
                if len(block) > room:
                    overflow.set()
        except OSError:
            pipe_error.set()
        finally:
            pipe.close()

    def write():
        try:
            child.stdin.write(payload)
            child.stdin.flush()
        except (BrokenPipeError, OSError):
            pipe_error.set()
        finally:
            child.stdin.close()

    threads = [threading.Thread(target=read, args=(child.stdout, streams[0], stdout_limit)),
               threading.Thread(target=read, args=(child.stderr, streams[1], stderr_limit)),
               threading.Thread(target=write)]
    started_threads = []
    failure = None
    try:
        for thread in threads:
            thread.start()
            started_threads.append(thread)
        while child.poll() is None:
            if overflow.is_set():
                failure = "output_limit"
            elif cancel is not None and cancel.is_set():
                failure = "cancelled"
            elif pipe_error.is_set():
                failure = "pipe_error"
            elif time.perf_counter() - started >= timeout:
                failure = "timeout"
            if failure:
                child.kill()  # Only this Popen-owned child, never another process.
                break
            time.sleep(0.01)
    except KeyboardInterrupt:
        failure = "cancelled"
        child.kill()
    finally:
        if child.poll() is None:
            child.kill()
        code = child.wait()
        for thread in started_threads:
            thread.join()
        for pipe in (child.stdin,child.stdout,child.stderr):
            if not pipe.closed:
                pipe.close()
    if failure is None and overflow.is_set():
        failure = "output_limit"
    if failure is None and pipe_error.is_set():
        failure = "pipe_error"
    return Result(code, round((time.perf_counter() - started) * 1000, 3),
                  bytes(streams[0]), bytes(streams[1]), failure)
