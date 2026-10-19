export type StorageTier="hot_database"|"warm_object"|"cold_archive";
export type ArtifactClass="research_evidence"|"decision_audit"|"market_bars"|"simulation_dataset"|"report"|"temporary";
export type StorageRule={kind:ArtifactClass;tier:StorageTier;immutable:boolean;retentionDays:number|null;compression:"none"|"parquet_zstd"|"gzip";reason:string};
export const storageRules:StorageRule[]=[
 {kind:"research_evidence",tier:"hot_database",immutable:true,retentionDays:null,compression:"none",reason:"Canonical provenance, agent claims, and challenges remain queryable"},
 {kind:"decision_audit",tier:"hot_database",immutable:true,retentionDays:null,compression:"none",reason:"Preserve decisions, vetoes and model versions for independent replay"},
 {kind:"market_bars",tier:"warm_object",immutable:true,retentionDays:null,compression:"parquet_zstd",reason:"Partition large time-series data by symbol and observation date"},
 {kind:"simulation_dataset",tier:"warm_object",immutable:true,retentionDays:null,compression:"parquet_zstd",reason:"Maintain versioned point-in-time research datasets"},
 {kind:"report",tier:"warm_object",immutable:true,retentionDays:null,compression:"gzip",reason:"Retain signed research artifacts separate from transactional data"},
 {kind:"temporary",tier:"cold_archive",immutable:false,retentionDays:30,compression:"gzip",reason:"Expire only disposable derived artifacts, never research sources"}
];
export function selectStorage(kind:ArtifactClass){return storageRules.find(r=>r.kind===kind)!;}
export function budgetSnapshot(input:{dbBytes:number;objectBytes:number;objectTransfersBytes:number}){
 const safe=(n:number)=>Number.isFinite(n)&&n>=0?n:0;
 return {dbGiB:safe(input.dbBytes)/2**30,objectGiB:safe(input.objectBytes)/2**30,transferGiB:safe(input.objectTransfersBytes)/2**30,estimatedProviderCost:null,note:"Usage metrics only. Provider billing depends on plan, operations and current rates; no invented cost forecast."};
}
export const storageControls={publicUploadsAllowed:false,anonymousResearchWritesAllowed:false,objectStoreConfigured:true,objectTransferEnabled:false,externalArchiveConnected:false,provider:"Neon Object Storage",metadataStore:"Neon PostgreSQL",brokerageExecutionEnabled:false} as const;
