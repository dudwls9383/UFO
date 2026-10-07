"""UFO 신고 달력용 1차 예측 프로토타입.

이 파일은 웹페이지용 코드가 아니다. 지역 x 날짜 신고 여부를 만들고,
과거 정보만 사용해 미래 신고 가능성을 평가하는 모델 실험용 코드다.
결과는 outputs/ 아래 CSV와 JSON으로 저장한다.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parent
IN_COLAB = "google.colab" in sys.modules or Path("/content").exists()
if IN_COLAB:
    existing_csv = Path("/content/ufo_sightings_scrubbed.csv")
    if existing_csv.exists():
        SOURCE = existing_csv
    else:
        from google.colab import files

        uploaded = files.upload()
        csv_names = [name for name in uploaded if name.lower().endswith(".csv")]
        if len(csv_names) != 1:
            raise ValueError("CSV 파일을 정확히 한 개 업로드하세요.")
        SOURCE = Path(csv_names[0])
else:
    SOURCE = Path(os.environ.get("UFO_SOURCE", r"C:\Users\Administrator\Desktop\ufo_sightings_scrubbed.csv"))

OUTPUT = Path("/content/ufo_calendar_prototype" if IN_COLAB else ROOT / "outputs")
OUTPUT.mkdir(exist_ok=True)

START_YEAR = 2000
END_YEAR = 2013
GRID_SIZE = 0.5
TOP_REGIONS = 6
SEED = 2026


def load_data() -> pd.DataFrame:
    df = pd.read_csv(SOURCE, low_memory=False)
    df.columns = df.columns.str.strip()
    df["time"] = pd.to_datetime(df["datetime"], format="mixed", errors="coerce")
    for col in ["latitude", "longitude"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["shape_clean"] = df["shape"].astype("string").str.strip().str.lower()
    df = df.dropna(subset=["time", "latitude", "longitude"])
    df = df[
        df["time"].dt.year.between(START_YEAR, END_YEAR)
        & df["latitude"].between(-90, 90)
        & df["longitude"].between(-180, 180)
        & ~((df["latitude"] == 0) & (df["longitude"] == 0))
    ].copy()
    df["date"] = df["time"].dt.normalize()
    df["lat_bin"] = np.floor(df["latitude"] / GRID_SIZE).astype(int)
    df["lon_bin"] = np.floor(df["longitude"] / GRID_SIZE).astype(int)
    return df


def choose_regions(df: pd.DataFrame) -> pd.DataFrame:
    counts = (
        df.groupby(["lat_bin", "lon_bin"])
        .size()
        .sort_values(ascending=False)
        .head(TOP_REGIONS)
        .rename("all_reports")
        .reset_index()
    )
    counts["region_id"] = [f"R{i + 1:02d}" for i in range(len(counts))]
    counts["lat_min"] = counts.lat_bin * GRID_SIZE
    counts["lat_max"] = counts.lat_min + GRID_SIZE
    counts["lon_min"] = counts.lon_bin * GRID_SIZE
    counts["lon_max"] = counts.lon_min + GRID_SIZE
    city = (
        df.merge(counts[["lat_bin", "lon_bin"]], on=["lat_bin", "lon_bin"])
        .assign(city_clean=lambda x: x.city.fillna("Unnamed").astype(str).str.strip())
        .groupby(["lat_bin", "lon_bin"])["city_clean"]
        .agg(lambda s: s.value_counts().index[0])
        .rename("representative_city")
        .reset_index()
    )
    counts = counts.merge(city, on=["lat_bin", "lon_bin"])
    counts.to_csv(OUTPUT / "regions.csv", index=False, encoding="utf-8-sig")
    return counts


def make_daily_panel(df: pd.DataFrame, regions: pd.DataFrame) -> pd.DataFrame:
    dates = pd.date_range(f"{START_YEAR}-01-01", f"{END_YEAR}-12-31", freq="D")
    keys = regions[["region_id", "lat_bin", "lon_bin"]].assign(key=1)
    calendar = pd.DataFrame({"date": dates, "key": 1})
    panel = keys.merge(calendar, on="key").drop(columns="key")
    reports = (
        df.merge(regions[["region_id", "lat_bin", "lon_bin"]], on=["lat_bin", "lon_bin"])
        .groupby(["region_id", "date"])
        .size()
        .rename("report_count")
        .reset_index()
    )
    panel = panel.merge(reports, on=["region_id", "date"], how="left")
    panel["report_count"] = panel["report_count"].fillna(0).astype(int)
    panel["has_report"] = (panel["report_count"] > 0).astype(int)
    panel = panel.sort_values(["region_id", "date"]).reset_index(drop=True)
    panel["month"] = panel.date.dt.month
    panel["weekday"] = panel.date.dt.weekday
    panel["month_sin"] = np.sin(2 * np.pi * panel.month / 12)
    panel["month_cos"] = np.cos(2 * np.pi * panel.month / 12)
    panel["weekday_sin"] = np.sin(2 * np.pi * panel.weekday / 7)
    panel["weekday_cos"] = np.cos(2 * np.pi * panel.weekday / 7)
    grouped = panel.groupby("region_id", group_keys=False)
    panel["lag_1"] = grouped.report_count.shift(1).fillna(0)
    panel["rolling_7_prior"] = grouped.report_count.transform(
        lambda s: s.shift(1).rolling(7, min_periods=1).sum()
    )
    panel["rolling_30_prior"] = grouped.report_count.transform(
        lambda s: s.shift(1).rolling(30, min_periods=1).sum()
    )
    panel[FEATURES] = panel[FEATURES].fillna(0)
    return panel


FEATURES = [
    "month_sin",
    "month_cos",
    "weekday_sin",
    "weekday_cos",
    "lag_1",
    "rolling_7_prior",
    "rolling_30_prior",
]


def add_historical_shape_time_features(
    panel: pd.DataFrame, df: pd.DataFrame, regions: pd.DataFrame, reference_end: pd.Timestamp
) -> pd.DataFrame:
    """Add shape/hour summaries calculated only from the training period."""
    known = df[
        df.shape_clean.notna()
        & ~df.shape_clean.isin(["", "unknown"])
        & (df.time <= reference_end)
    ].copy()
    known = known.merge(regions[["region_id", "lat_bin", "lon_bin"]], on=["lat_bin", "lon_bin"])
    known["month"] = known.time.dt.month
    shape_counts = known.groupby(["region_id", "month", "shape_clean"]).size()
    shape_share = shape_counts.groupby(level=[0, 1]).apply(lambda s: s.max() / s.sum())
    hour_counts = known.assign(hour=known.time.dt.hour).groupby(["region_id", "month", "hour"]).size()
    hour_share = hour_counts.groupby(level=[0, 1]).apply(lambda s: s.max() / s.sum())
    shape_features = shape_share.rename("historical_top_shape_share").reset_index()
    hour_features = hour_share.rename("historical_top_hour_share").reset_index()
    enriched = panel.merge(shape_features, on=["region_id", "month"], how="left")
    enriched = enriched.merge(hour_features, on=["region_id", "month"], how="left")
    enriched[["historical_top_shape_share", "historical_top_hour_share"]] = enriched[
        ["historical_top_shape_share", "historical_top_hour_share"]
    ].fillna(0)
    return enriched


def evaluate(panel: pd.DataFrame, df: pd.DataFrame, regions: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    train = panel[panel.date.dt.year <= 2010].copy()
    valid = panel[panel.date.dt.year.between(2011, 2012)].copy()
    test = panel[panel.date.dt.year == 2013].copy()

    train_end = train.date.max()
    train = add_historical_shape_time_features(train, df, regions, train_end)
    valid = add_historical_shape_time_features(valid, df, regions, train_end)
    test = add_historical_shape_time_features(test, df, regions, train_end)
    seasonal = ["month_sin", "month_cos", "weekday_sin", "weekday_cos"]
    history = ["lag_1", "rolling_7_prior", "rolling_30_prior"]
    shape_time = ["historical_top_shape_share", "historical_top_hour_share"]
    feature_sets = {
        "M1_seasonality": seasonal,
        "M2_seasonality_history": seasonal + history,
        "M3_seasonality_history_region": seasonal + history + ["region_id"],
        "M4_full_region_shape_time": seasonal + history + ["region_id"] + shape_time,
        # M5 compares a tree ensemble with M4's full input set. The split,
        # rows, features, and metrics stay identical so the comparison is fair.
        "M5_random_forest": seasonal + history + ["region_id"] + shape_time,
    }

    def make_model(model_name: str):
        if model_name == "M5_random_forest":
            return RandomForestClassifier(
                n_estimators=400,
                min_samples_leaf=5,
                max_features="sqrt",
                class_weight=None,
                random_state=SEED,
                n_jobs=-1,
            )
        return make_pipeline(
            StandardScaler(),
            LogisticRegression(class_weight=None, max_iter=2000, random_state=SEED),
        )

    def design(frame: pd.DataFrame, features: list[str], columns: list[str] | None = None):
        x = pd.get_dummies(frame[features], columns=["region_id"] if "region_id" in features else [], dtype=float)
        if columns is not None:
            x = x.reindex(columns=columns, fill_value=0)
        return x

    rows = []
    predictions_by_model = {}
    validation_predictions_by_model = {}
    for model_name, features in feature_sets.items():
        x_train = design(train, features)
        x_valid = design(valid, features, list(x_train.columns))
        x_test = design(test, features, list(x_train.columns))
        model = make_model(model_name)
        model.fit(x_train, train.has_report)
        valid_probability = model.predict_proba(x_valid)[:, 1]
        test_probability = model.predict_proba(x_test)[:, 1]
        validation_predictions_by_model[model_name] = valid_probability
        predictions_by_model[model_name] = test_probability
        for split_name, frame, probability in [
            ("validation_2011_2012", valid, valid_probability),
            ("test_2013", test, test_probability),
        ]:
            rows.append(
                {
                    "model": model_name,
                    "split": split_name,
                    "rows": len(frame),
                    "positive_rate": float(frame.has_report.mean()),
                    "roc_auc": float(roc_auc_score(frame.has_report, probability)),
                    "pr_auc": float(average_precision_score(frame.has_report, probability)),
                    "precision_at_top_20pct": float(
                        precision_score(frame.has_report, probability >= np.quantile(probability, 0.8), zero_division=0)
                    ),
                    "recall_at_top_20pct": float(
                        recall_score(frame.has_report, probability >= np.quantile(probability, 0.8), zero_division=0)
                    ),
                }
            )

    comparison = pd.DataFrame(rows)
    rolling_splits = [(2007, 2008, 2009), (2009, 2010, 2011), (2011, 2012, 2012)]
    rolling_rows = []
    for train_end_year, valid_start_year, valid_end_year in rolling_splits:
        rolling_train = panel[panel.date.dt.year <= train_end_year].copy()
        rolling_valid = panel[panel.date.dt.year.between(valid_start_year, valid_end_year)].copy()
        rolling_train = add_historical_shape_time_features(rolling_train, df, regions, rolling_train.date.max())
        rolling_valid = add_historical_shape_time_features(rolling_valid, df, regions, rolling_train.date.max())
        for model_name, features in feature_sets.items():
            x_train = design(rolling_train, features)
            x_valid = design(rolling_valid, features, list(x_train.columns))
            model = make_model(model_name)
            model.fit(x_train, rolling_train.has_report)
            probability = model.predict_proba(x_valid)[:, 1]
            rolling_rows.append(
                {
                    "model": model_name,
                    "train_end_year": train_end_year,
                    "validation_period": f"{valid_start_year}-{valid_end_year}",
                    "rows": len(rolling_valid),
                    "positive_rate": float(rolling_valid.has_report.mean()),
                    "roc_auc": float(roc_auc_score(rolling_valid.has_report, probability)),
                    "pr_auc": float(average_precision_score(rolling_valid.has_report, probability)),
                }
            )
    rolling = pd.DataFrame(rolling_rows)
    rolling.to_csv(OUTPUT / "rolling_validation.csv", index=False, encoding="utf-8-sig")
    rolling_summary = (
        rolling.groupby("model")[["roc_auc", "pr_auc"]]
        .mean()
        .sort_values(["pr_auc", "roc_auc"], ascending=False)
    )
    rolling_summary.to_csv(OUTPUT / "rolling_model_summary.csv", encoding="utf-8-sig")
    best_model_name = rolling_summary.index[0]
    test["probability"] = predictions_by_model[best_model_name]
    validation_probability = validation_predictions_by_model[best_model_name]
    calibration = pd.DataFrame(
        {"probability": validation_probability, "has_report": valid.has_report.to_numpy()}
    )
    calibration["calibration_bin"] = pd.qcut(
        calibration.probability, q=5, duplicates="drop"
    )
    calibration_table = (
        calibration.groupby("calibration_bin", observed=True)
        .agg(
            rows=("has_report", "size"),
            mean_predicted_probability=("probability", "mean"),
            actual_report_rate=("has_report", "mean"),
        )
        .reset_index()
    )
    calibration_table["absolute_gap"] = (
        calibration_table.mean_predicted_probability - calibration_table.actual_report_rate
    ).abs()
    calibration_table.to_csv(OUTPUT / "calibration_validation.csv", index=False, encoding="utf-8-sig")
    quantiles = np.quantile(validation_probability, [0.2, 0.4, 0.6, 0.8]).tolist()
    (OUTPUT / "calendar_level_thresholds.json").write_text(
        json.dumps(
            {
                "method": "validation_probability_quantiles",
                "quantiles": [0.2, 0.4, 0.6, 0.8],
                "thresholds": quantiles,
                "labels": ["very_low", "low", "medium", "high", "very_high"],
                "note": "Relative ranking levels based on validation predictions, not absolute occurrence probabilities.",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    predictions = test[["region_id", "date", "report_count", "has_report", "probability"]].copy()
    predictions["level"] = pd.cut(
        predictions.probability,
        bins=[-np.inf, *quantiles, np.inf],
        labels=["very_low", "low", "medium", "high", "very_high"],
        include_lowest=True,
    ).astype(str)
    predictions.to_csv(OUTPUT / "calendar_predictions_2013.csv", index=False, encoding="utf-8-sig")
    comparison.to_csv(OUTPUT / "model_comparison.csv", index=False, encoding="utf-8-sig")
    (OUTPUT / "selected_model.txt").write_text(best_model_name, encoding="utf-8")
    return comparison, predictions


def make_shape_time_summary(df: pd.DataFrame, regions: pd.DataFrame) -> pd.DataFrame:
    known = df[df.shape_clean.notna() & ~df.shape_clean.isin(["", "unknown"])].copy()
    known = known.merge(regions[["region_id", "lat_bin", "lon_bin"]], on=["lat_bin", "lon_bin"])
    known["hour"] = known.time.dt.hour
    rows = []
    for (region_id, month), group in known.groupby(["region_id", known.time.dt.month]):
        shape = group.shape_clean.value_counts().index[0]
        hour = int(group.time.dt.hour.value_counts().index[0])
        rows.append(
            {
                "region_id": region_id,
                "month": int(month),
                "top_shape": shape,
                "top_shape_share_pct": round(100 * group.shape_clean.value_counts().iloc[0] / len(group), 2),
                "top_hour": hour,
                "reports_with_known_shape": len(group),
            }
        )
    result = pd.DataFrame(rows)
    result.to_csv(OUTPUT / "shape_time_summary.csv", index=False, encoding="utf-8-sig")
    return result


def make_web_outputs(
    predictions: pd.DataFrame, regions: pd.DataFrame, shape_time: pd.DataFrame
) -> None:
    """Create page-ready outputs without evaluation-only ground-truth columns."""
    web = predictions.drop(columns=["report_count", "has_report"]).copy()
    web["date"] = pd.to_datetime(web["date"]).dt.strftime("%Y-%m-%d")
    web["month"] = pd.to_datetime(web["date"]).dt.month
    region_columns = [
        "region_id",
        "representative_city",
        "lat_min",
        "lat_max",
        "lon_min",
        "lon_max",
    ]
    web = web.merge(regions[region_columns], on="region_id", how="left")
    web = web.merge(
        shape_time[
            [
                "region_id",
                "month",
                "top_shape",
                "top_shape_share_pct",
                "top_hour",
                "reports_with_known_shape",
            ]
        ],
        on=["region_id", "month"],
        how="left",
    )
    web.to_csv(OUTPUT / "calendar_predictions_web.csv", index=False, encoding="utf-8-sig")
    payload = {
        "interpretation": "Relative probability of at least one historical report, not physical UFO occurrence probability.",
        "selected_model": (OUTPUT / "selected_model.txt").read_text(encoding="utf-8").strip(),
        "regions": regions[region_columns].to_dict("records"),
        "calendar": web.to_dict("records"),
    }
    (OUTPUT / "calendar_payload.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    df = load_data()
    regions = choose_regions(df)
    panel = make_daily_panel(df, regions)
    metrics, predictions = evaluate(panel, df, regions)
    shape_time = make_shape_time_summary(df[df.time.dt.year <= 2010].copy(), regions)
    make_web_outputs(predictions, regions, shape_time)
    metrics.to_csv(OUTPUT / "model_metrics.csv", index=False, encoding="utf-8-sig")
    summary = {
        "purpose": "Prototype for region x date UFO report probability",
        "source_rows_after_cleaning": int(len(df)),
        "years": [START_YEAR, END_YEAR],
        "regions": int(regions.region_id.nunique()),
        "features": FEATURES + ["region_id", "historical_top_shape_share", "historical_top_hour_share"],
        "train_period": "2000-2010",
        "validation_period": "2011-2012",
        "test_period": "2013",
        "interpretation": "Report probability, not physical UFO occurrence probability.",
        "outputs": [
            "regions.csv",
            "calendar_predictions_2013.csv",
            "shape_time_summary.csv",
            "model_metrics.csv",
            "model_comparison.csv",
            "rolling_validation.csv",
            "rolling_model_summary.csv",
            "calibration_validation.csv",
            "calendar_level_thresholds.json",
            "calendar_predictions_web.csv",
            "calendar_payload.json",
            "selected_model.txt",
        ],
    }
    (OUTPUT / "run_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(metrics.to_string(index=False))
    print(f"Saved {len(predictions):,} calendar rows and {len(shape_time):,} shape/time summary rows to {OUTPUT}")


if __name__ == "__main__":
    main()
