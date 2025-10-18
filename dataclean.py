import pandas as pd

df = pd.read_csv("data/wildfire_aqi_dataset.csv")

smoke_to_float = {
    "none": 0.0,
    "light": 1.0,
    "medium": 1.0,
    "heavy": 1.0,
}

df["fire_event_active"] = (
    df["status"]
    .str.lower()
    .map(smoke_to_float)
    .fillna(0.0)  # optional fallback if unexpected labels appear
)

df.to_csv("data/wildfire_aqi_dataset_clean.csv", index=False)
