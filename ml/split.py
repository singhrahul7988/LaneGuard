from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .config import TEST_DAYS, VAL_DAYS


@dataclass(frozen=True)
class DateRange:
    start: str | None
    end: str | None


@dataclass(frozen=True)
class DatasetSplit:
    train: pd.DataFrame
    validation: pd.DataFrame
    test: pd.DataFrame
    train_range: DateRange
    validation_range: DateRange
    test_range: DateRange


def _range_from_frame(frame: pd.DataFrame) -> DateRange:
    if frame.empty:
        return DateRange(start=None, end=None)
    dates = frame["target_next_shift_date"].astype(str)
    return DateRange(start=dates.min(), end=dates.max())


def split_by_target_date(
    frame: pd.DataFrame,
    validation_days: int = VAL_DAYS,
    test_days: int = TEST_DAYS,
) -> DatasetSplit:
    target_dates = sorted(frame["target_next_shift_date"].astype(str).unique())
    if len(target_dates) < validation_days + test_days + 3:
        raise ValueError(
            "Not enough unique target dates for a strict train/validation/test split. "
            f"Found {len(target_dates)} unique dates."
        )

    test_dates = set(target_dates[-test_days:])
    validation_dates = set(target_dates[-(validation_days + test_days):-test_days])

    train = frame[
        ~frame["target_next_shift_date"].astype(str).isin(validation_dates | test_dates)
    ].copy()
    validation = frame[frame["target_next_shift_date"].astype(str).isin(validation_dates)].copy()
    test = frame[frame["target_next_shift_date"].astype(str).isin(test_dates)].copy()

    if train.empty or validation.empty or test.empty:
        raise ValueError("Split produced an empty partition.")

    return DatasetSplit(
        train=train,
        validation=validation,
        test=test,
        train_range=_range_from_frame(train),
        validation_range=_range_from_frame(validation),
        test_range=_range_from_frame(test),
    )
