"""Tiny test generator. The weights file is the model."""

import hashlib
import io
import os

import torch
import torch.nn as nn
from PIL import Image


class TinyGenerator(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(32, 64),
            nn.Tanh(),
            nn.Linear(64, 16 * 16 * 3),
        )

    def forward(self, prompt_vec):
        return torch.sigmoid(self.net(prompt_vec)).view(1, 3, 16, 16)


def prompt_vector(prompt: str) -> torch.Tensor:
    digest = hashlib.sha256(prompt.encode()).digest()
    values = [(byte / 127.5) - 1 for byte in digest]
    return torch.tensor([values], dtype=torch.float32)


_cache: dict[str, TinyGenerator] = {}


def render(weights_path: str, prompt: str) -> bytes:
    model = _cache.get(weights_path)
    if model is None:
        model = TinyGenerator()
        model.load_state_dict(torch.load(weights_path, map_location="cpu", weights_only=True))
        model.eval()
        _cache[weights_path] = model
    with torch.no_grad():
        pixels = model(prompt_vector(prompt))
    image = pixels.squeeze(0).permute(1, 2, 0).mul(255).byte().numpy()
    picture = Image.fromarray(image, mode="RGB").resize((512, 512), Image.Resampling.NEAREST)
    buf = io.BytesIO()
    picture.save(buf, format="PNG")
    return buf.getvalue()


def write_test_model(path: str) -> None:
    torch.manual_seed(0)
    torch.save(TinyGenerator().state_dict(), path)


def _self_check() -> None:
    import tempfile

    handle, path = tempfile.mkstemp(suffix=".pt")
    os.close(handle)
    write_test_model(path)
    first = render(path, "a red pig")
    second = render(path, "a blue boat")
    if not first.startswith(b"\x89PNG") or first == second or render(path, "a red pig") != first:
        raise SystemExit("test model check failed")
    os.remove(path)


_self_check()

if __name__ == "__main__":
    destination = os.path.join(os.path.dirname(__file__), "test-model.pt")
    write_test_model(destination)
    digest = hashlib.sha256(open(destination, "rb").read()).hexdigest()
    print(destination)
    print(f"sha256:{digest}")
