'use client';
import {useRef,useState} from 'react';
export default function DataReadiness(){
 const sent=useRef(false);
 const [attempted,setAttempted]=useState(false),[result,setResult]=useState('');
 async function run(){
  if(sent.current)return;
  sent.current=true;
  setAttempted(true);setResult('Checking…');
  try{
   const response=await fetch('/api/operations/owner-data-readiness',{method:'POST',credentials:'same-origin',redirect:'error',headers:{'x-tradeos-diagnostic':'owner-read-only-v1'},signal:AbortSignal.timeout(65000)});
   setResult(JSON.stringify(await response.json(),null,2));
  }catch{setResult('No confirmed result. Do not retry; ask the operator to inspect the request status.');}
 }
 return <main style={{padding:24,maxWidth:900,margin:'auto'}}><h1>Data readiness check</h1><p>For the verified owner during an approved diagnostic window. This checks the three pilot symbols without saving evidence or enabling collection.</p><p>Run only when the operator has approved this one-time check. The button sends one request and does not retry.</p><button disabled={attempted} onClick={run}>{attempted?'Request sent':'Run approved check once'}</button><pre style={{whiteSpace:'pre-wrap'}}>{result}</pre></main>;
}
