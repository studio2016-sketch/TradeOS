import {NextResponse} from "next/server";
import {storageRules,storageControls} from "../../../lib/storage/policy";
export const dynamic="force-dynamic";
export function GET(){return NextResponse.json({status:"architecture_defined",tiers:storageRules,controls:storageControls,storageUsageAvailable:false,costEstimateAvailable:false,generatedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});}
