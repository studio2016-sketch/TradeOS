"""Compatibility entrypoint: exercise the exact assertion projections used by production."""
import pathlib,subprocess,unittest
class GraphAuditContract(unittest.TestCase):
 def test_current_projection_contract(self):
  root=pathlib.Path(__file__).resolve().parents[1]
  result=subprocess.run(['node','--import','tsx','--test','tests/private-detailed-audit.test.ts'],cwd=root,capture_output=True,text=True)
  self.assertEqual(result.returncode,0,result.stdout+result.stderr)
