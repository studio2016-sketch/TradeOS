export type TimedBar={symbol:string;timestamp:string;receivedAt:string;close:number;volume:number;source:string};
export type FeedAssessment={accepted:boolean;issues:string[];observedAt:string|null;ageSeconds:number|null;provenanceVerified:false};
export function inspectMarketBar(bar:TimedBar,nowIso:string,maxAgeSeconds=120):FeedAssessment{
 const problems:string[]=[];
 const now=Date.parse(nowIso),event=Date.parse(bar.timestamp),received=Date.parse(bar.receivedAt);
 if(!/^[A-Z0-9.^-]{1,20}$/.test(bar.symbol))problems.push("Invalid security identifier");
 if(!bar.source||bar.source.length>160)problems.push("Source attribution missing");
 if(!Number.isFinite(now)||!Number.isFinite(event)||!Number.isFinite(received))problems.push("Invalid timestamps");
 if(Number.isFinite(event)&&Number.isFinite(received)&&received<event)problems.push("Received timestamp precedes event time");
 if(Number.isFinite(event)&&Number.isFinite(now)&&event>now+5000)problems.push("Observation is future dated");
 const age=Number.isFinite(now)&&Number.isFinite(event)?(now-event)/1000:null;
 if(age===null||age>maxAgeSeconds||age< -5)problems.push("Observation not sufficiently fresh");
 if(!Number.isFinite(bar.close)||bar.close<=0||!Number.isFinite(bar.volume)||bar.volume<0)problems.push("Invalid price or volume");
 return {accepted:problems.length===0,issues:problems,observedAt:Number.isFinite(event)?new Date(event).toISOString():null,ageSeconds:age,provenanceVerified:false};
}
