import unittest
from datetime import datetime, timedelta
from update import rain_increment, summarize, TZ, STEP


def row(t, total=0, daily=0):
    return [t, 60, 70, 2, 4, 180, total, daily, 0]


class RainTests(unittest.TestCase):
    def test_counter_difference_and_reset(self):
        t = int(datetime(2026, 1, 1, tzinfo=TZ).timestamp() * 1000)
        self.assertEqual(rain_increment(row(t-STEP, 10, 1), row(t, 0, 0)), 0)
        self.assertEqual(rain_increment(row(t, 0, 0), row(t+STEP, .02, .02)), .02)
        self.assertIsNone(rain_increment(row(t, 5, 2), row(t+STEP, 0, 0)))

    def test_missing_interval_is_unknown(self):
        self.assertIsNone(rain_increment(None, row(0)))
        self.assertIsNone(rain_increment(row(0), row(STEP*2, .5)))
        self.assertEqual(rain_increment(row(0), row(STEP)), 0)

    def test_day_lengths_and_midnight_interval(self):
        for date, expected in [('2026-03-08', 276), ('2026-11-01', 300), ('2026-11-03', 288)]:
            start = datetime.fromisoformat(date).replace(tzinfo=TZ)
            t = int(start.timestamp()*1000)
            rows = [row(t+i*STEP, i*.01) for i in range(expected+1)]
            result = next(d for d in summarize(rows) if d['date'] == date)
            self.assertEqual(result['samples'], expected)
            self.assertEqual(result['expected'], expected)
            self.assertTrue(result['complete'])
            self.assertAlmostEqual(result['rain'], expected*.01)


if __name__ == '__main__':
    unittest.main()
