"""Remove open PR reports from the CI retention deletion candidates."""
import json
import os
from urllib.request import Request, urlopen
import re
import sys


def deletion_candidates(names, open_prs):
    protected = {int(pr["number"]) for pr in open_prs}
    for name in names:
        name = name.strip()
        match = re.fullmatch(r"pr-(\d+)-(\d+)(?:-mobile)?", name)
        if match and int(match[1]) not in protected:
            yield name


def fetch_open_prs(repository, token, api_url="https://api.github.com"):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Invalid repository")
    prs = []
    page = 1
    while True:
        request = Request(
            f"{api_url}/repos/{repository}/pulls?state=open&per_page=100&page={page}",
            headers={"Authorization": f"Bearer {token}",
                     "Accept": "application/vnd.github+json"},
        )
        with urlopen(request, timeout=30) as response:
            batch = json.load(response)
        # Validate the entire response before returning any cleanup input.
        prs.extend({"number": int(pr["number"])} for pr in batch)
        if len(batch) < 100:
            return prs
        page += 1


if __name__ == "__main__":
    if sys.argv[1] == "--open-prs":
        print(json.dumps(fetch_open_prs(
            sys.argv[2], os.environ["GH_TOKEN"],
            os.environ.get("GITHUB_API_URL", "https://api.github.com"),
        )))
        sys.exit(0)
    # Parse before emitting anything: invalid API data must never allow deletion.
    for name in deletion_candidates(sys.stdin, json.loads(sys.argv[1])):
        print(name)
