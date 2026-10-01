"""Remove open PR reports from the CI retention deletion candidates."""
import json
import re
import sys


def deletion_candidates(names, open_prs):
    protected = {int(pr["number"]) for pr in open_prs}
    for name in names:
        name = name.strip()
        match = re.fullmatch(r"pr-(\d+)-(\d+)(?:-mobile)?", name)
        if match and int(match[1]) not in protected:
            yield name


if __name__ == "__main__":
    # Parse before emitting anything: invalid API data must never allow deletion.
    for name in deletion_candidates(sys.stdin, json.loads(sys.argv[1])):
        print(name)
