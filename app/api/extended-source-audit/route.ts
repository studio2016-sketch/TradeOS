import {withPrivateRead} from "../../../lib/auth/private-read";
import {privateGET} from "../../../lib/operations/internal-audit-models/extended-source-audit";
export const dynamic="force-dynamic";
export const maxDuration=60;
export const GET=withPrivateRead(privateGET);
