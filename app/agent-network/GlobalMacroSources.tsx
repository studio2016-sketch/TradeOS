import {macroSourceCatalog} from "../../lib/research/global-financial-sources";
export default function GlobalMacroSources(){
 return <section style={{marginTop:24,padding:22,border:"1px solid #bba372",borderRadius:14,background:"#112936"}}>
 <h2>Global Financial Intelligence Sources</h2>
 <p>Curated authoritative research inputs for US and global markets. Listed sources are a research integration roadmap, <strong>not proof that live ingestion is connected</strong>. News can create investigation leads, never trading instructions.</p>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
 {macroSourceCatalog.map(s=><article key={s.id} style={{border:"1px solid #527083",padding:13,borderRadius:10}}>
 <strong>{s.name}</strong><p style={{fontSize:13}}>{s.area}</p><p style={{fontSize:12,opacity:.8}}>{s.drivers.join(" · ")}</p><a href={s.url} target="_blank" rel="noopener noreferrer" style={{color:"#e0be7b"}}>Official source ↗</a>
 </article>)}</div></section>;
}
