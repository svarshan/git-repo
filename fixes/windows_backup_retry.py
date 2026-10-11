"""Windows backup rename helper for MoOLVa 2.4.

Call replace_with_retry(temp, target) after closing all SQLite connections.
"""
import os
import time

def replace_with_retry(temp, target, attempts=8):
    for index in range(attempts):
        try:
            os.replace(temp, target)
            return
        except PermissionError as error:
            if getattr(error, "winerror", None) not in (5, 32, 33) or index == attempts - 1:
                raise
            time.sleep(0.15 * (index + 1))

def cleanup_temporary_file(temp, attempts=8):
    for index in range(attempts):
        try:
            temp.unlink(missing_ok=True)
            return
        except PermissionError as error:
            if getattr(error, "winerror", None) not in (5, 32, 33):
                raise
            time.sleep(0.15 * (index + 1))
