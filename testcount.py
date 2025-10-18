from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd


def main() -> int:
    """
    Count rows with an active fire event indicator (> 0.0) in the specified CSV.
    """
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/wildfire_aqi_dataset_clean.csv")
    df = pd.read_csv(csv_path)
    count = (df["fire_event_active"] > 0.0).sum()
    print(count)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
