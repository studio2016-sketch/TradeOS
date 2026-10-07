export interface MacroEvent{
  uid:string;
  summary:string;
  date:string;
  time:string|null;
  timezone:string|null;
  importance:"high"|"medium"|"low";
  source:"BLS";
}

const HIGH=[
  /consumer price index/i,/employment situation/i,/producer price index/i,
  /job openings and labor turnover/i,/employment cost index/i
];
const MED=[/productivity and costs/i,/import and export price/i,/real earnings/i];

function importance(summary:string):MacroEvent["importance"]{
  if(HIGH.some(r=>r.test(summary)))return"high";
  if(MED.some(r=>r.test(summary)))return"medium";
  return"low";
}

function unfold(text:string){
  const raw=text.replace(/\r/g,"").split("\n"),out:string[]=[];
  for(const line of raw){
    if((line.startsWith(" ")||line.startsWith("\t"))&&out.length)out[out.length-1]+=line.slice(1);
    else out.push(line);
  }
  return out;
}

export async function blsMacroCalendar():Promise<MacroEvent[]>{
  const res=await fetch("https://www.bls.gov/schedule/news_release/bls.ics",{next:{revalidate:21600}});
  if(!res.ok)throw new Error(`BLS calendar HTTP ${res.status}`);
  const lines=unfold(await res.text());
  const events:MacroEvent[]=[];
  let cur:Record<string,string>|null=null;
  for(const line of lines){
    if(line==="BEGIN:VEVENT"){cur={};continue;}
    if(line==="END:VEVENT"){
      if(cur){
        const summary=cur.SUMMARY||"";
        const dtKey=Object.keys(cur).find(k=>k.startsWith("DTSTART"));
        const raw=dtKey?cur[dtKey]:"";
        const tz=dtKey?.match(/TZID=([^:;]+)/)?.[1]??null;
        const m=raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
        if(m&&summary){
          events.push({
            uid:cur.UID||summary+"-"+raw,
            summary,
            date:`${m[1]}-${m[2]}-${m[3]}`,
            time:m[4]?`${m[4]}:${m[5]}`:null,
            timezone:tz,
            importance:importance(summary),
            source:"BLS"
          });
        }
      }
      cur=null;continue;
    }
    if(cur){
      const idx=line.indexOf(":");
      if(idx>0)cur[line.slice(0,idx)]=line.slice(idx+1).replace(/\\,/g,",").replace(/\\n/gi," ");
    }
  }
  return events.sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
}

export async function macroRiskContext(){
  const events=await blsMacroCalendar();
  const today=new Date();
  const localDate=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(today);
  const future=events.filter(e=>e.date>=localDate&&e.importance!=="low").slice(0,20);
  const next=future[0]??null;
  let score=90;
  let state:"clear"|"watch"|"high-risk"="clear";
  if(next){
    const day0=new Date(localDate+"T12:00:00Z").getTime(),day1=new Date(next.date+"T12:00:00Z").getTime();
    const days=Math.round((day1-day0)/86400000);
    if(days<=0){score=30;state="high-risk";}
    else if(days===1){score=52;state="watch";}
    else if(days<=3){score=70;state="watch";}
  }
  return{source:"BLS",generatedAt:new Date().toISOString(),score,state,next,events:future};
}
