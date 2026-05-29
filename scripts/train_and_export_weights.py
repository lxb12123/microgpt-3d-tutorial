"""
Train microGPT (per src/microgpt_annotated.py) to convergence on the names
dataset, then dump every learned weight matrix into a JSON blob the TS
inference engine consumes at runtime.

Run once before V1 ships. Output: public/data/weights/microgpt-weights.json.

Reproducibility: microgpt_annotated.py pins its own seed (random.seed(42)) at
the top of the file before any Value() initialization or training, so the
import-time training is deterministic. We pin random.seed(1337) here too so
any post-import randomness (none currently, but defensive) is also pinned.
"""
import json
import os
import random
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
sys.path.insert(0, os.path.join(REPO_ROOT, 'src'))

# Belt-and-suspenders seeding. microgpt_annotated.py also calls random.seed(42)
# internally before any stochastic op, so its training is reproducible.
random.seed(1337)

# Importing microgpt_annotated triggers data download (if needed), parameter
# init, the full training loop, and a final inference demo — all at import
# time. After import, `state_dict` holds the trained Value matrices.
import microgpt_annotated as gpt  # noqa: E402

OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'data', 'weights', 'microgpt-weights.json')


def to_plain(obj):
    """Recursively unwrap a (possibly nested) list of Value scalars into JSON-serializable floats."""
    # Bare Value
    if hasattr(obj, 'data') and not isinstance(obj, (list, tuple)):
        return obj.data
    # List / tuple — recurse
    if isinstance(obj, (list, tuple)):
        return [to_plain(item) for item in obj]
    # Already a plain number
    return obj


def main() -> None:
    params = {}

    # The canonical store of learned weights in microgpt_annotated.py is
    # `state_dict`: dict[str, list[list[Value]]]. Keys are 'wte', 'wpe',
    # 'lm_head', and per-layer attn_w{q,k,v,o} + mlp_fc{1,2}.
    if not hasattr(gpt, 'state_dict'):
        raise RuntimeError(
            'microgpt_annotated.state_dict is missing — has the canonical file changed?'
        )
    for name, matrix in gpt.state_dict.items():
        params[name] = to_plain(matrix)

    # Save the char-level vocab so the TS tokenizer matches byte-for-byte.
    # microgpt_annotated.py exposes `uchars` (sorted list of chars), with the
    # BOS token id implicitly equal to len(uchars). We persist both so the TS
    # side doesn't have to re-derive the convention.
    if not hasattr(gpt, 'uchars'):
        raise RuntimeError(
            'microgpt_annotated.uchars is missing — has the canonical file changed?'
        )
    params['_vocab'] = list(gpt.uchars)
    params['_bos_id'] = gpt.BOS
    params['_vocab_size'] = gpt.vocab_size

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(params, f)

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f'[train_and_export] wrote {OUTPUT_PATH} ({size_kb:.1f} KB, {len(params)} keys)')


if __name__ == '__main__':
    main()
