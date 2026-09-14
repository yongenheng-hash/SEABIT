import importlib.util
import sys
import types
import unittest
from pathlib import Path
from datetime import datetime, timezone

sys.modules.setdefault('feedparser', types.ModuleType('feedparser'))
spec = importlib.util.spec_from_file_location('update', Path(__file__).parents[1] / 'update.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class FeedTests(unittest.TestCase):
    def test_sources_preserved(self):
        ts = datetime.now(timezone.utc).isoformat()
        common = dict(ts=ts, title='Central bank announces monetary policy decision',
                      region='US', blurb='', weight=10)
        stories = [dict(common, id=str(i), source='Source '+str(i), url='https://example.com/'+str(i)) for i in range(2)]
        grouped = mod.cluster(stories)
        self.assertEqual(len(grouped), 1)
        self.assertEqual(len(grouped[0]['sources']), 2)
        self.assertEqual(grouped[0]['bias'], 'unassessed')
        old = dict(grouped[0], sources=[], title='Preserve historical title')
        merged, _, _ = mod.merge(grouped, [old])
        self.assertEqual(merged[0]['title'], 'Preserve historical title')
        self.assertEqual(len(merged[0]['sources']), 2)

if __name__ == '__main__':
    unittest.main()
