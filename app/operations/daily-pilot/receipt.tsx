import type {PilotReceipt} from '../../../lib/research/durable-pilot-receipt';
const titles={verified:'Saved collection verified',unverified:'Saved completion needs review',claimed:'Session claimed; completion unconfirmed',none:'No saved pilot session found',unavailable:'Saved receipt unavailable'};
export default function Receipt({receipt}:{receipt:PilotReceipt}){
 return <section aria-labelledby="saved-receipt-title" style={{background:'#f0f4e9',color:'#24392f',border:'1px solid #b8cbb4',borderRadius:16,padding:22,margin:'24px 0'}}>
  <small>LAST DURABLE PILOT RECEIPT · READ ONLY</small><h2 id="saved-receipt-title">{titles[receipt.status]}</h2>
  {receipt.session&&<p>Market session: <strong>{receipt.session}</strong></p>}
  {receipt.status==='verified'?<>
   <p><strong>{receipt.verifiedIdentities} descriptive factor records</strong> matched a fresh replay of the stored inputs and their original hashes. This confirms saved collection evidence, not predictive accuracy.</p>
   <p>New rows saved by that completion: <strong>{receipt.newlySaved}</strong>. Verified identities can include identical rows that already existed.</p>
   <ul>{receipt.symbols?.map(s=><li key={s.symbol}>{s.symbol}: {s.factors} factors from {s.inputBars} stored daily bars</li>)}</ul>
   <p>Evidence became available: <time dateTime={receipt.availableAt}>{receipt.availableAt}</time></p>
  </>:receipt.status==='unverified'?<p>A completion is stored, but its claim, inputs and evidence did not pass replay verification. Do not treat it as a verified collection or retry the session.</p>
   :receipt.status==='claimed'?<p>A durable claim exists without a saved completion. This does not establish that collection is still running, failed safely, or may be retried. Ask the operator to inspect it.</p>
   :receipt.status==='none'?<p>No durable claim or completion was found. This is not permission to start collection.</p>
   :<p>The saved records could not be checked. No successful collection or safe retry is inferred. The earlier on-screen response is not a substitute for a durable receipt.</p>}
  <div style={{display:'flex',flexWrap:'wrap',gap:16,borderTop:'1px solid #b8cbb4',paddingTop:14}}>
   <strong>Scientific certification: blocked</strong><strong>Order execution: blocked</strong>
  </div>
  <p>This is a historical receipt, not a current market assessment. Checking it does not collect data, refresh provider prices, enable orders or change safeguards.</p>
  <small>Checked: <time dateTime={receipt.checkedAt}>{receipt.checkedAt}</time>{receipt.verificationVersion?` · ${receipt.verificationVersion}`:''}</small>
  <p><a href="/operations/daily-pilot" style={{color:'#294b33',textDecoration:'underline'}}>Refresh saved receipt (read only)</a></p>
 </section>;
}
