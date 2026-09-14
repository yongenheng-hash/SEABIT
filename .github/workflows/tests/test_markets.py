import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import update_markets as m

class Markets(unittest.TestCase):
    def test_missing_is_not_zero(self):
        self.assertEqual(m.clean([{'date':'2025-01-01','value':None},{'date':'2025-01-02','value':'NaN'},{'date':'2025-01-03','value':0}]),[{'date':'2025-01-03','value':0.0}])
    def test_calendar_yoy_not_row_offset(self):
        result=m.yoy([{'date':'2024-01-01','value':100},{'date':'2024-03-01','value':110},{'date':'2025-01-01','value':105}])
        self.assertEqual(len(result),1)
        self.assertAlmostEqual(result[0]['value'],5)
    def test_failed_refresh_and_revision(self):
        old=[{'date':'2025-01-01','value':4}]
        self.assertEqual(m.merge(old,[]),old)
        self.assertEqual(m.merge(old,[{'date':'2025-01-01','value':4.1}])[0]['value'],4.1)
    def test_future_invalid_and_no_fake_tenor(self):
        self.assertEqual(m.clean([{'date':'2099-01-01','value':4},{'date':'invalid','value':4}]),[])
        self.assertNotIn('us_yield_25y',m.REGISTRY)

if __name__=='__main__':unittest.main()
