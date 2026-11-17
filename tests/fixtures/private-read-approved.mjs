// Explicit owner authorization fixture for underlying route behavior tests.
import {withPrivateRead as actual} from '../../lib/auth/private-read.ts';
export const withPrivateRead=handler=>actual(handler,async()=>200);
