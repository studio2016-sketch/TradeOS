import {withPrivateRead} from "../../../lib/auth/private-read";
import {privateGET} from "../../../lib/operations/internal-audit-models/market";
export const dynamic="force-dynamic";
export const GET=withPrivateRead(privateGET);
