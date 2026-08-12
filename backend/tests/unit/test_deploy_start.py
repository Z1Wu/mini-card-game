from pathlib import Path

import pytest


@pytest.mark.unit
def test_deploy_entrypoint_validates_before_starting_services():
    repository_root = Path(__file__).resolve().parents[3]
    start_script = (repository_root / "deploy" / "start.sh").read_text(encoding="utf-8")
    dockerfile = (repository_root / "Dockerfile.deploy").read_text(encoding="utf-8")

    validation = 'uv run python -c "from config import Config; Config.validate_startup_configuration()"'
    backend_start = "uv run python main.py &"
    nginx_start = "exec nginx -g 'daemon off;'"

    assert validation in start_script
    assert start_script.index(validation) < start_script.index(backend_start)
    assert start_script.index(backend_start) < start_script.index(nginx_start)
    assert 'COPY deploy/start.sh /start.sh' in dockerfile
    assert 'CMD ["/start.sh"]' in dockerfile
